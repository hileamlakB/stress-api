from fastapi import APIRouter, HTTPException, Depends, status, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid
import logging
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any

from api_models import (
    TestStatus, 
    StressTestTaskRequest, 
    StressTestTaskResponse,
    StressTestTaskConfig,
    StressTestEndpointTaskConfig,
    StressTestProgressResponse,
    StressTestResultsResponse,
    SessionStatusResponse,
    SessionInfo
)
from backend.database.database import get_db
from backend.database.crud import (
    get_session, 
    create_session_config, 
    create_test_result,
    get_test_result_by_test_id,
    update_test_result
)

# Import stress tester
from stress_tester import StressTester

# Simple in-memory queue
from task_queue import add_task, get_task_status, worker_loop

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(
    prefix="/api/stress-test",
    tags=["stress-test"],
    responses={404: {"description": "Not found"}},
)

# Initialize stress tester
stress_tester = StressTester()

# Dictionary to track active tests
test_progress = {}

# Dependency for authentication verification (imported from main.py)
async def verify_email_confirmed(authorization: str = Header(None)):
    """Dependency to check if a user's email is verified"""
    # This is a placeholder - in the real implementation, 
    # we would import this from main.py or a dedicated auth module
    # For now, we'll just pass through
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )
    return True

# Start background worker once
_worker_started = False
def _ensure_worker():
    global _worker_started
    if not _worker_started:
        asyncio.create_task(worker_loop())
        _worker_started = True

@router.post("/task", response_model=StressTestTaskResponse)
async def start_stress_test_task(
    request: StressTestTaskRequest, 
    db: Session = Depends(get_db), 
    _: None = Depends(verify_email_confirmed)
):
    """
    Start a new stress test based on the provided configuration.
    This endpoint queues a test task and returns a test ID for monitoring progress.
    """
    try:
        # Log the received request with detailed configuration
        logger.info("===== RECEIVED STRESS TEST REQUEST =====")
        logger.info(f"Request config: {request.config}")
        
        # Log endpoints details
        logger.info("Endpoints to test:")
        for i, endpoint in enumerate(request.config.endpoints):
            logger.info(f"  {i+1}. {endpoint.method} {endpoint.path}")
            if endpoint.test_data_samples:
                logger.info(f"     Test data samples: {len(endpoint.test_data_samples)}")
        
        # Log authentication details
        if request.config.authentication:
            auth_type = request.config.authentication.type
            logger.info(f"Authentication type: {auth_type}")
            if auth_type == "session":
                logger.info(f"  Login endpoint: {request.config.authentication.login_endpoint}")
                if getattr(request.config.authentication, 'multiple_accounts', False) and getattr(request.config.authentication, 'accounts', None):
                    logger.info(f"  Using multiple accounts: {len(request.config.authentication.accounts)}")
                else:
                    logger.info("  Using single account")
        else:
            logger.info("No authentication configured")
        
        # Log test parameters
        logger.info(f"Max concurrent users: {request.config.max_concurrent_users}")
        logger.info(f"Request rate: {request.config.request_rate}")
        logger.info(f"Duration: {request.config.duration} seconds")
        logger.info(f"Distribution strategy: {request.config.strategy}")
        if request.config.strategy_options:
            logger.info(f"Strategy options: {request.config.strategy_options}")
        logger.info("========================================")
        
        # Generate test ID or use provided one
        test_id = request.test_id if request.test_id else str(uuid.uuid4())
        config = request.config
        
        _ensure_worker()
        task_params = {
            "task_id": test_id,
            "config": config.dict() if isinstance(config, BaseModel) else config,
            "type": "stress_test",  # Mark task type explicitly
            "request_time": datetime.now().isoformat()
        }
        logger.info(f"Adding complete stress test config to queue with ID {test_id}")
        await add_task(task_params)

        return StressTestTaskResponse(
            test_id=test_id,
            status=TestStatus.PENDING,
            message="Task queued successfully",
            timestamp=datetime.now()
        )
    except Exception as e:
        logger.error(f"Error starting stress test: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error starting stress test: {str(e)}"
        )

@router.get("/{test_id}/progress", response_model=StressTestProgressResponse)
async def get_test_progress(
    test_id: str, 
    db: Session = Depends(get_db), 
    _: None = Depends(verify_email_confirmed)
):
    """Get the progress of a running stress test"""
    try:
        # Log the progress request
        logger.info(f"[PROGRESS] Progress request for test ID: {test_id}")
        
        # Fetch status from task manager
        task_info = get_task_status(test_id)
        if not task_info:
            logger.warning(f"[PROGRESS] Test with ID {test_id} not found")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Test with ID {test_id} not found")

        # Convert status to a valid TestStatus enum value
        if task_info.get("status") == "not_found":
            logger.warning(f"[PROGRESS] Test with ID {test_id} not found in task manager")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Test with ID {test_id} not found")
        elif task_info.get("status") not in [s.value for s in TestStatus]:
            status_val = TestStatus.PENDING
        else:
            status_val = TestStatus(task_info.get("status"))
            
        # Include auth sessions in the response if available
        auth_sessions = None
        if "authenticated_users" in task_info:
            auth_sessions = task_info.get("authenticated_users", [])
            logger.info(f"[PROGRESS] Including {len(auth_sessions)} auth sessions in response for test {test_id}")
        
        # Get concurrency level data if available
        concurrency_levels = None
        if "results" in task_info and "concurrency_levels" in task_info["results"]:
            concurrency_levels = task_info["results"]["concurrency_levels"]
            
            # Add counts for easier visualization
            total_completed = 0
            for level, data in concurrency_levels.items():
                if "total_requests" in data:
                    total_completed += data["total_requests"]
                    # Add a percentage calculation for UI display
                    if data["total_requests"] > 0:
                        data["success_rate"] = round(data["successful_requests"] / data["total_requests"] * 100, 1)
                    else:
                        data["success_rate"] = 0
                        
                    # Add response time ranges for visualization
                    data["response_time_range"] = [
                        data["min_response_time"] if "min_response_time" in data else 0,
                        data["max_response_time"] if "max_response_time" in data else 0
                    ]
                        
                    # Add endpoint summary for each endpoint
                    if "endpoints" in data:
                        for endpoint, endpoint_data in data["endpoints"].items():
                            if "requests" in endpoint_data and endpoint_data["requests"] > 0:
                                endpoint_data["success_rate"] = round(endpoint_data["successful"] / endpoint_data["requests"] * 100, 1)
                            else:
                                endpoint_data["success_rate"] = 0
            
            logger.info(f"[PROGRESS] Including data for {len(concurrency_levels)} concurrency levels, total requests: {total_completed}")
        
        # Calculate elapsed time
        start_time = task_info.get("start_time")
        end_time = task_info.get("end_time")
        elapsed_time = 0
        
        if start_time:
            if status_val in [TestStatus.COMPLETED, TestStatus.FAILED, TestStatus.STOPPED] and end_time:
                # For completed tests, use the final elapsed time
                elapsed_time = (end_time - start_time).total_seconds()
            else:
                # For running tests, calculate from now
                elapsed_time = (datetime.now() - start_time).total_seconds()
        
        # Count completed requests
        completed_requests = 0
        if "results" in task_info and "summary" in task_info["results"]:
            completed_requests = task_info["results"]["summary"].get("total_requests", 0)
        
        # Check if results are available
        results_available = False
        if "results" in task_info and "concurrency_levels" in task_info["results"]:
            results_available = len(task_info["results"]["concurrency_levels"]) > 0
            
        # Create the response
        response = StressTestProgressResponse(
            test_id=test_id,
            status=status_val,
            elapsed_time=elapsed_time,
            completed_requests=completed_requests,
            results_available=results_available,
            message=task_info.get("message"),
            auth_sessions=auth_sessions,
            concurrency_levels=concurrency_levels,
            current_level=task_info.get("current_level"),
            total_levels=task_info.get("total_levels"),
            current_level_index=task_info.get("current_level_index")
        )
        
        # Log the progress information
        logger.info(f"[PROGRESS] Progress for test {test_id}: status={response.status.value}, " 
                   f"elapsed={response.elapsed_time:.1f}s, completed={response.completed_requests}, "
                   f"results_available={response.results_available}, "
                   f"current_level={response.current_level}")
        
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting test progress: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error getting test progress: {str(e)}"
        )

@router.post("/{test_id}/stop")
async def stop_test(
    test_id: str, 
    db: Session = Depends(get_db), 
    _: None = Depends(verify_email_confirmed)
):
    """Stop a running stress test"""
    try:
        if test_id not in stress_tester.active_tests:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Test with ID {test_id} not found or already completed"
            )
        
        await stress_tester.stop_test(test_id)
        test_progress[test_id]["status"] = TestStatus.STOPPED
        
        # Update test result in the database if we have a session configuration
        session_config_id = test_progress.get(test_id, {}).get("session_config_id")
        if session_config_id:
            try:
                test_result = get_test_result_by_test_id(db, test_id)
                if test_result:
                    update_test_result(
                        db,
                        result_id=test_result.id,
                        status=TestStatus.STOPPED.value,
                        # Additional fields would be updated here
                        end_time=datetime.now()
                    )
            except Exception as e:
                logger.warning(f"Could not update test result in database: {str(e)}")
        
        return {"test_id": test_id, "status": "stopped", "message": "Test stopped successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping test: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error stopping test: {str(e)}"
        )
