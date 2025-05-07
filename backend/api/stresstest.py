from fastapi import APIRouter, HTTPException, Depends, status, Header
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime
import asyncio
import logging
from sqlalchemy.orm import Session

from stress_tester import StressTester
from api_models import (
    StressTestConfig,
    StressTestTaskRequest,
    TaskSubmitResponse,
    TaskStatus,
    StressTestEndpointConfig,
)
from task_queue.task_manager import TaskManager
from task_queue import db_interface as task_db
from backend.database.database import get_db
from backend.database.crud import (
    get_user_by_email,
    create_user,
    create_test_result,
    get_test_result_by_test_id,
    update_test_result
)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create a router instance
router = APIRouter(prefix="/api/stress", tags=["stress-test"])

# Initialize stress tester and task manager
stress_tester = StressTester()
task_manager = TaskManager.get_instance()

# Data model for incremental test request
class IncrementalStressTestRequest(BaseModel):
    target_url: HttpUrl
    endpoints: List[StressTestEndpointConfig]
    max_concurrent_users: int
    start_concurrency: int = 2
    step_size: int = 2
    test_duration_per_level: int = 30
    headers: Optional[Dict[str, str]] = None
    authentication: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None

class IncrementalTestResponse(BaseModel):
    task_id: str
    status: str
    concurrency_levels: List[int]
    message: str

# Handler function for incremental stress testing
async def handle_incremental_stress_test(
    task_id: str,
    params: Dict[str, Any],
    progress_callback: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Handler for incremental stress test tasks that test with increasing concurrency
    """
    logger.info(f"[DEBUG] Starting incremental stress test task: {task_id} with params: {params}")
    
    try:
        # Extract test parameters
        config = params.get("config", {})
        target_url = config.get("target_url")
        endpoints = config.get("endpoints", [])
        max_concurrent_users = config.get("max_concurrent_users", 10)
        start_concurrency = config.get("start_concurrency", 2)
        step_size = config.get("step_size", 2)
        test_duration_per_level = config.get("test_duration_per_level", 30)
        headers = config.get("headers", {})
        authentication = config.get("authentication", None)
        
        logger.warning(f"[DEBUG] Incremental test configuration: target_url={target_url}, " 
                   f"endpoints={len(endpoints)}, max_concurrent_users={max_concurrent_users}, "
                   f"start_concurrency={start_concurrency}, step_size={step_size}")
        
        # Calculate concurrency levels
        concurrency_levels = []
        current_level = start_concurrency
        while current_level <= max_concurrent_users:
            concurrency_levels.append(current_level)
            current_level += step_size
        
        logger.info(f"[DEBUG] Calculated concurrency levels: {concurrency_levels}")
        
        # Initialize results structure
        results_by_endpoint = {}
        for endpoint in endpoints:
            endpoint_key = f"{endpoint['method']} {endpoint['path']}"
            results_by_endpoint[endpoint_key] = {
                "endpoint": endpoint_key,
                "method": endpoint["method"],
                "path": endpoint["path"],
                "metrics_by_concurrency": {}
            }
        
        # Report total number of tests to run
        total_levels = len(concurrency_levels)
        if progress_callback:
            logger.info(f"[DEBUG] Calling progress callback with initial info: {total_levels} levels")
            progress_callback(5, f"Preparing to test {total_levels} concurrency levels: {concurrency_levels}", None)
        
        # Setup authentication if needed
        if authentication:
            if progress_callback:
                progress_callback(10, "Setting up authentication", None)
                
            auth_type = authentication.get("type")
            logger.info(f"[DEBUG] Setting up authentication of type: {auth_type}")
            
            if auth_type == "session":
                login_endpoint = authentication.get("login_endpoint")
                login_method = authentication.get("login_method", "POST")
                
                # Handle multiple accounts
                if authentication.get("multiple_accounts", False):
                    accounts = authentication.get("accounts", [])
                    for i, account in enumerate(accounts):
                        await stress_tester.acquire_session(
                            test_id=task_id,
                            login_url=login_endpoint,
                            login_method=login_method,
                            credentials=account,
                            account_id=account.get("username", f"Account-{i}")
                        )
                # Handle single account
                elif authentication.get("login_payload"):
                    await stress_tester.acquire_session(
                        test_id=task_id,
                        login_url=login_endpoint,
                        login_method=login_method,
                        credentials=authentication.get("login_payload")
                    )
            elif auth_type == "token":
                if authentication.get("tokens"):
                    tokens = authentication.get("tokens", [])
                    stress_tester.set_authentication_tokens(task_id, tokens)
        
        # Run tests at each concurrency level
        overall_start_time = datetime.now()
        max_concurrency_reached = 0
        
        # Store all results for each concurrency level
        all_level_results = {}
        
        for i, concurrency in enumerate(concurrency_levels):
            # Update progress
            progress_percentage = 10 + int((i / total_levels) * 80)
            if progress_callback:
                logger.info(f"[DEBUG] Updating progress for level {concurrency}: {progress_percentage}%")
                progress_callback(
                    progress_percentage, 
                    f"Testing with {concurrency} concurrent users ({i+1}/{total_levels})", 
                    None
                )
            
            # Run test at current concurrency level
            try:
                logger.info(f"[DEBUG] Starting test with {concurrency} concurrent users")
                
                # Clear previous results to ensure clean test
                if task_id in stress_tester.results:
                    del stress_tester.results[task_id]
                
                # Configure and run the test
                await stress_tester.run_sequential_test(
                    test_id=task_id,
                    target_url=target_url,
                    endpoints=endpoints,
                    max_concurrent_users=concurrency,  # Current concurrency level
                    duration=test_duration_per_level,
                    headers=headers
                )
                
                logger.info(f"[DEBUG] Waiting for test with {concurrency} users to complete")
                
                # Wait for test to complete
                await asyncio.sleep(test_duration_per_level + 5)  # Add buffer time
                
                # Stop the test explicitly to ensure completion
                await stress_tester.stop_test(task_id)
                
                # Check results availability
                level_results = stress_tester.results.get(task_id, {})
                logger.info(f"[DEBUG] Results for concurrency {concurrency}: "
                           f"Endpoints: {list(level_results.keys())}, "
                           f"Data available: {bool(level_results)}")
                
                # Store results for this concurrency level
                all_level_results[concurrency] = level_results
                
                # Get results for this concurrency level to process metrics
                
                # Process results for each endpoint
                for endpoint_key, endpoint_results in level_results.items():
                    # Skip if no results for this endpoint
                    if not endpoint_results:
                        logger.info(f"[DEBUG] No results for endpoint {endpoint_key} at concurrency {concurrency}")
                        continue
                    
                    # Combine multiple result sets for the same endpoint (if any)
                    success_count = sum(r.get("success_count", 0) for r in endpoint_results)
                    failure_count = sum(r.get("failure_count", 0) for r in endpoint_results)
                    total_count = success_count + failure_count
                    
                    logger.info(f"[DEBUG] Endpoint {endpoint_key} metrics at {concurrency}: "
                               f"success={success_count}, failed={failure_count}, total={total_count}")
                    
                    # Calculate weighted average response time
                    weighted_avg_time = 0
                    if total_count > 0:
                        weighted_avg_time = sum(
                            r.get("avg_response_time", 0) * (r.get("success_count", 0) + r.get("failure_count", 0))
                            for r in endpoint_results
                        ) / total_count
                    
                    # Get min/max response times
                    min_time = min((r.get("min_response_time", float('inf')) for r in endpoint_results), default=0)
                    max_time = max((r.get("max_response_time", 0) for r in endpoint_results), default=0)
                    
                    # Combine status codes
                    status_codes = {}
                    for r in endpoint_results:
                        for code, count in r.get("status_codes", {}).items():
                            status_codes[code] = status_codes.get(code, 0) + count
                    
                    # Collect error details
                    error_details = []
                    for r in endpoint_results:
                        if r.get("error_details"):
                            error_details.extend(r.get("error_details"))
                    
                    # Store the metrics for this concurrency level
                    if endpoint_key in results_by_endpoint:
                        results_by_endpoint[endpoint_key]["metrics_by_concurrency"][concurrency] = {
                            "concurrency_level": concurrency,
                            "total_requests": total_count,
                            "successful_requests": success_count,
                            "failed_requests": failure_count,
                            "avg_response_time": weighted_avg_time,
                            "min_response_time": min_time,
                            "max_response_time": max_time,
                            "status_codes": status_codes,
                            "error_details": error_details if error_details else None
                        }
                
                # Update max concurrency reached
                max_concurrency_reached = concurrency
                
                # Log success
                logger.info(f"[DEBUG] Completed test with {concurrency} concurrent users")
                
                # Update progress with partial results
                if progress_callback:
                    partial_results = {
                        "test_id": task_id,
                        "status": "running",
                        "progress": progress_percentage,
                        "max_concurrency_reached": max_concurrency_reached,
                        "concurrency_levels_completed": concurrency_levels[:i+1],
                        "results_by_endpoint": results_by_endpoint
                    }
                    logger.info(f"[DEBUG] Sending partial results for {concurrency} users")
                    progress_callback(progress_percentage, f"Completed test with {concurrency} concurrent users", partial_results)
                
            except Exception as e:
                logger.error(f"[DEBUG] Error during concurrency level {concurrency}: {str(e)}")
                # Continue with next level unless it's a critical error
                if "connection refused" in str(e).lower() or "cannot connect" in str(e).lower():
                    logger.error(f"[DEBUG] Stopping test due to connection error: {str(e)}")
                    break
        
        # Calculate overall metrics
        overall_metrics = calculate_overall_metrics(results_by_endpoint)
        logger.info(f"[DEBUG] Overall metrics: Total requests: {overall_metrics['total_requests']}, "
                   f"Successful: {overall_metrics['successful_requests']}")
        
        # Prepare raw results by endpoint for each concurrency level
        raw_results = {
            endpoint_key: {} for endpoint_key in results_by_endpoint.keys()
        }
        
        for concurrency, level_data in all_level_results.items():
            for endpoint_key, endpoint_results in level_data.items():
                if endpoint_key in raw_results:
                    raw_results[endpoint_key][concurrency] = endpoint_results
        
        # Compose final results
        final_results = {
            "summary": {
                "test_id": task_id,
                "start_time": overall_start_time,
                "end_time": datetime.now(),
                "status": "completed",
                "max_concurrency_reached": max_concurrency_reached,
                "target_concurrency": max_concurrent_users,
                "concurrency_levels": concurrency_levels[:concurrency_levels.index(max_concurrency_reached) + 1] if max_concurrency_reached in concurrency_levels else [],
                "raw_results": raw_results
            },
            "results": results_by_endpoint,
            "metrics": overall_metrics,
            "config": config
        }
        
        logger.info(f"[DEBUG] Final results: results for {len(results_by_endpoint)} endpoints, "
                   f"max concurrency reached: {max_concurrency_reached}")
        
        if progress_callback:
            logger.info(f"[DEBUG] Sending final results")
            progress_callback(100, "Incremental stress test completed", final_results)
        
        return final_results
        
    except Exception as e:
        logger.error(f"[DEBUG] Fatal error in incremental stress test: {str(e)}")
        return {
            "status": "failed",
            "error": str(e),
            "test_id": task_id
        }

def calculate_overall_metrics(results_by_endpoint):
    """Calculate overall metrics across all endpoints and concurrency levels"""
    overall = {
        "total_requests": 0,
        "successful_requests": 0,
        "failed_requests": 0,
        "avg_response_time_by_concurrency": {},
        "success_rate_by_concurrency": {},
        "throughput_by_concurrency": {}
    }
    
    # Find all concurrency levels across all endpoints
    all_concurrency_levels = set()
    for endpoint_data in results_by_endpoint.values():
        all_concurrency_levels.update(endpoint_data.get("metrics_by_concurrency", {}).keys())
    
    # Create metrics for each concurrency level
    for concurrency in all_concurrency_levels:
        total_requests = 0
        successful_requests = 0
        weighted_avg_time = 0
        
        # Sum up metrics across all endpoints for this concurrency level
        for endpoint_data in results_by_endpoint.values():
            if concurrency in endpoint_data.get("metrics_by_concurrency", {}):
                metrics = endpoint_data["metrics_by_concurrency"][concurrency]
                
                total_requests += metrics["total_requests"]
                successful_requests += metrics["successful_requests"]
                weighted_avg_time += metrics["avg_response_time"] * metrics["total_requests"]
        
        # Calculate aggregated metrics
        overall["total_requests"] += total_requests
        overall["successful_requests"] += successful_requests
        overall["failed_requests"] += (total_requests - successful_requests)
        
        # Calculate average metrics for this concurrency level
        if total_requests > 0:
            overall["avg_response_time_by_concurrency"][str(concurrency)] = weighted_avg_time / total_requests
            overall["success_rate_by_concurrency"][str(concurrency)] = (successful_requests / total_requests) * 100
            overall["throughput_by_concurrency"][str(concurrency)] = total_requests / 30  # requests per second (assuming 30s test duration)
    
    return overall

# Register the task handler
logger.info("Registering incremental_stress_test handler from stresstest.py")
task_manager.register_task_handler("incremental_stress_test", handle_incremental_stress_test)

# Debug endpoint to test incremental stress test task creation directly
@router.post("/debug/incremental-test")
async def debug_incremental_test():
    """
    Debug endpoint to create a test incremental stress test task directly.
    """
    try:
        # Create minimal test parameters
        test_params = {
            "config": {
                "target_url": "http://example.com",
                "endpoints": [
                    {"path": "/", "method": "GET", "weight": 1}
                ],
                "max_concurrent_users": 10,
                "start_concurrency": 2,
                "step_size": 2,
                "test_duration_per_level": 5
            }
        }
        
        # Submit the task explicitly with the correct type
        task_id = task_manager.submit_task(
            task_type="incremental_stress_test",
            params=test_params,
            user_id=None
        )
        
        # Get the task directly to check its type
        task_info = task_manager.get_task_status(task_id)
        handler_info = task_manager.task_handlers.get("incremental_stress_test")
        
        return {
            "task_id": task_id,
            "task_type": task_info.get("task_type"),
            "handler_registered": "incremental_stress_test" in task_manager.task_handlers,
            "handler_name": handler_info.__name__ if handler_info else "Not found",
            "registered_handlers": list(task_manager.task_handlers.keys())
        }
    except Exception as e:
        logger.error(f"Error in debug incremental test: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Debug test failed: {str(e)}"
        )

# API Endpoint for starting incremental stress test
@router.post("/incremental", response_model=IncrementalTestResponse)
async def start_incremental_stress_test(
    request: IncrementalStressTestRequest,
    db: Session = Depends(get_db)
):
    """
    Start an incremental stress test that tests the system with increasing concurrency levels.
    Results will be available through the standard task API endpoints.
    """
    try:
        # Convert request to dictionary format
        config_dict = request.dict()
        config_dict["target_url"] = str(request.target_url)
        
        # Create task parameters
        task_params = {
            "config": config_dict
        }
        
        # Log task submission for debugging
        logger.warning(f"[DEBUG] Submitting incremental stress test task with task_type='incremental_stress_test'")
        
        # Submit the task
        task_id = task_manager.submit_task(
            task_type="incremental_stress_test",
            params=task_params,
            user_id=request.user_id
        )
        
        # Get task from manager to verify type
        task_info = task_manager.get_task_status(task_id)
        logger.warning(f"[DEBUG] Created incremental task: id={task_id}, type={task_info.get('task_type')}, handlers={list(task_manager.task_handlers.keys())}")
        
        # Calculate concurrency levels
        concurrency_levels = []
        current_level = request.start_concurrency
        while current_level <= request.max_concurrent_users:
            concurrency_levels.append(current_level)
            current_level += request.step_size
        
        # Create database record for the test
        try:
            if request.user_id:
                # Try to create task record in database
                task_db.create_task_record(
                    db=db,
                    task_id=task_id,
                    task_type="incremental_stress_test",
                    params=task_params,
                    user_id=request.user_id
                )
                logger.info(f"Task record created for incremental stress test: {task_id}")
        except Exception as db_error:
            # Log but continue - the task can still run without DB record
            logger.error(f"Failed to create task record: {str(db_error)}")
        
        return IncrementalTestResponse(
            task_id=task_id,
            status="pending",
            concurrency_levels=concurrency_levels,
            message=f"Incremental stress test started with ID: {task_id}"
        )
        
    except Exception as e:
        logger.error(f"Error starting incremental stress test: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start stress test: {str(e)}"
        ) 