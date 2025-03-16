from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import uuid
from datetime import datetime
import httpx
import asyncio
import logging
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from stress_tester import StressTester
from openapi_parser import OpenAPIParser
from data_generator import RequestDataGenerator
from api_models import (
    HealthResponse,
    TargetValidationRequest,
    TargetValidationResponse,
    TestConfigRequest,
    TestStartResponse,
    TestResultsResponse,
    TestStopResponse,
    TestStatus,
    OpenAPIEndpointsRequest,
    OpenAPIEndpointsResponse,
    EndpointSchema,
    StressTestConfig,
    StressTestEndpointConfig,
    StressTestResultsResponse,
    StressTestProgressResponse,
    EndpointResult,
    DistributionStrategy
)
from metrics_generator import metrics_manager

# Session configuration models
class SessionConfigModel(BaseModel):
    id: str
    session_id: str
    endpoint_url: str
    http_method: str
    request_headers: Optional[Dict[str, Any]] = None
    request_body: Optional[Dict[str, Any]] = None
    request_params: Optional[Dict[str, Any]] = None
    concurrent_users: int
    ramp_up_time: int
    test_duration: int
    think_time: int
    success_criteria: Optional[Dict[str, Any]] = None

class SessionModel(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    configurations: List[SessionConfigModel]

class UserSessionsResponse(BaseModel):
    user_id: str
    email: str
    sessions: List[SessionModel]

class SessionConfigRequest(BaseModel):
    session_id: str
    endpoint_url: str
    http_method: str
    request_headers: Optional[Dict[str, Any]] = None
    request_body: Optional[Dict[str, Any]] = None
    request_params: Optional[Dict[str, Any]] = None
    concurrent_users: int
    ramp_up_time: int
    test_duration: int
    think_time: int
    success_criteria: Optional[Dict[str, Any]] = None

app = FastAPI(
    title="FastAPI Stress Tester Backend",
    description="Backend service for the FastAPI Stress Testing tool",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize stress tester
stress_tester = StressTester()

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(),
        version=app.version
    )

# Endpoint to validate target API
@app.post("/api/validate-target", response_model=TargetValidationResponse)
async def validate_target(request: TargetValidationRequest):
    try:
        # Implement actual validation logic
        try:
            # Convert HttpUrl to string before using rstrip
            target_url_str = str(request.target_url)
            openapi_url = f"{target_url_str.rstrip('/')}/openapi.json"
            async with httpx.AsyncClient() as client:
                response = await client.get(openapi_url, timeout=10.0)
                openapi_available = response.status_code == 200
            
            return TargetValidationResponse(
                status="valid",
                message="Target API is accessible",
                openapi_available=openapi_available
            )
        except Exception as e:
            return TargetValidationResponse(
                status="invalid",
                message=f"Target API validation failed: {str(e)}",
                openapi_available=False
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# New endpoint to get API endpoints from OpenAPI
@app.post("/api/openapi-endpoints", response_model=OpenAPIEndpointsResponse)
async def get_openapi_endpoints(request: OpenAPIEndpointsRequest):
    try:
        # Fetch and parse OpenAPI endpoints 
        endpoints = await OpenAPIParser.get_endpoints(str(request.target_url))
        
        return OpenAPIEndpointsResponse(
            target_url=request.target_url,
            endpoints=endpoints,
            timestamp=datetime.now()
        )
    except OpenAPIParser.OpenAPIError as e:
        # Handle specific OpenAPI errors with appropriate status codes
        status_code = status.HTTP_422_UNPROCESSABLE_ENTITY  # Default for OpenAPI validation errors
        
        # Check if we have a more specific status code from the error
        if hasattr(e, 'status_code') and e.status_code:
            if e.status_code == 404:
                status_code = status.HTTP_404_NOT_FOUND
            elif e.status_code >= 500:
                status_code = status.HTTP_502_BAD_GATEWAY
            
        raise HTTPException(
            status_code=status_code,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing request: {str(e)}"
        )

# Endpoint to generate sample request data for an endpoint
@app.post("/api/generate-sample-data")
async def generate_sample_data(endpoint: EndpointSchema):
    try:
        # Generate sample request data based on schema
        data_generator = RequestDataGenerator()
        
        # Generate sample data for request body if available
        sample_data = {}
        if endpoint.request_body:
            sample_data = data_generator.generate_request_data(endpoint.request_body)
        
        # Generate sample data for parameters
        param_data = {}
        for param in endpoint.parameters:
            if param.param_schema:
                param_data[param.name] = data_generator.generate_primitive(
                    param.param_schema.get('type', 'string'),
                    param.param_schema.get('format'),
                    param.param_schema.get('enum')
                )
        
        return {
            "endpoint": f"{endpoint.method} {endpoint.path}",
            "request_body": sample_data,
            "parameters": param_data
        }
    except Exception as e:
        logger.error(f"Error generating sample data: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error generating sample data: {str(e)}"
        )

# Endpoint to start stress test
@app.post("/api/start-test", response_model=TestStartResponse)
async def start_test(config: TestConfigRequest):
    try:
        test_id = str(uuid.uuid4())
        # Start the test asynchronously
        await stress_tester.run_test(
            test_id=test_id,
            target_url=str(config.target_url),
            concurrent_users=config.concurrent_users,
            request_rate=config.request_rate,
            duration=config.duration,
            endpoints=config.endpoints,
            headers=config.headers,
            payload_data=config.payload_data
        )
        
        return TestStartResponse(
            test_id=test_id,
            status=TestStatus.RUNNING,
            config=config,
            start_time=datetime.now()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Endpoint to get test results
@app.get("/api/test-results/{test_id}", response_model=TestResultsResponse)
async def get_test_results(test_id: str):
    try:
        results = stress_tester.get_results(test_id)
        
        # Calculate summary statistics
        summary = {
            "total_requests": len(results),
            "successful_requests": sum(1 for r in results if r["success"]),
            "failed_requests": sum(1 for r in results if not r["success"]),
            "avg_response_time": sum(r["response_time"] for r in results) / len(results) if results else 0,
            "min_response_time": min((r["response_time"] for r in results), default=0),
            "max_response_time": max((r["response_time"] for r in results), default=0),
        }
        
        return TestResultsResponse(
            test_id=test_id,
            status=TestStatus.COMPLETED if not stress_tester.active_tests.get(test_id) else TestStatus.RUNNING,
            results=results,
            summary=summary
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

# Endpoint to stop ongoing test
@app.post("/api/stop-test/{test_id}", response_model=TestStopResponse)
async def stop_test(test_id: str):
    try:
        if stress_tester.stop_test(test_id):
            return TestStopResponse(
                test_id=test_id,
                status=TestStatus.STOPPED,
                stop_time=datetime.now()
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test {test_id} not found or already completed"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Endpoint to start an advanced stress test with multiple strategies
@app.post("/api/advanced-test", response_model=TestStartResponse)
async def start_advanced_test(config: StressTestConfig):
    try:
        test_id = str(uuid.uuid4())
        
        # Fetch endpoint schemas if they exist
        endpoint_schemas = {}
        try:
            schema = await OpenAPIParser.fetch_openapi_spec(str(config.target_url))
            # Build a dictionary of endpoint schemas for easy lookup
            for endpoint_info in OpenAPIParser.parse_schema(schema):
                endpoint_key = f"{endpoint_info.method} {endpoint_info.path}"
                endpoint_schemas[endpoint_key] = {
                    "parameters": [param.dict() for param in endpoint_info.parameters],
                    "requestBody": endpoint_info.request_body
                }
        except Exception as e:
            logger.warning(f"Could not fetch OpenAPI schema: {e}. Will proceed without schema validation.")
        
        # Convert endpoint config objects to dictionaries
        endpoint_configs = []
        for endpoint in config.endpoints:
            endpoint_configs.append({
                "path": endpoint.path,
                "method": endpoint.method,
                "weight": endpoint.weight,
                "custom_parameters": endpoint.custom_parameters
            })
        
        # Start the test asynchronously
        asyncio.create_task(stress_tester.run_advanced_test(
            test_id=test_id,
            target_url=str(config.target_url),
            strategy=config.strategy,
            max_concurrent_users=config.max_concurrent_users,
            request_rate=config.request_rate,
            duration=config.duration,
            endpoints=endpoint_configs,
            headers=config.headers,
            endpoint_schemas=endpoint_schemas
        ))
        
        return TestStartResponse(
            test_id=test_id,
            status=TestStatus.RUNNING,
            config=TestConfigRequest(
                target_url=config.target_url,
                concurrent_users=config.max_concurrent_users,
                request_rate=config.request_rate,
                duration=config.duration,
                endpoints=[f"{e.method} {e.path}" for e in config.endpoints],
                headers=config.headers,
            ),
            start_time=datetime.now()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Endpoint to get advanced test progress
@app.get("/api/advanced-test/{test_id}/progress", response_model=StressTestProgressResponse)
async def get_advanced_test_progress(test_id: str):
    try:
        progress = stress_tester.get_test_progress(test_id)
        
        if progress["status"] == "not_found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Test {test_id} not found"
            )
        
        test_status = TestStatus.RUNNING
        if progress["status"] == "completed":
            test_status = TestStatus.COMPLETED
        
        return StressTestProgressResponse(
            test_id=test_id,
            status=test_status,
            elapsed_time=progress["elapsed_time"],
            completed_requests=progress["completed_requests"],
            results_available=progress["results_available"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Endpoint to get advanced test results
@app.get("/api/advanced-test/{test_id}/results", response_model=StressTestResultsResponse)
async def get_advanced_test_results(test_id: str):
    try:
        results = stress_tester.get_advanced_results(test_id)
        
        if not results:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Test {test_id} not found or has no results"
            )
        
        # Convert the raw results into the response model
        endpoint_results = []
        for endpoint_key, endpoint_data in results["results"].items():
            for result in endpoint_data:
                endpoint_results.append(result)
        
        return StressTestResultsResponse(
            test_id=test_id,
            status=TestStatus.COMPLETED if not stress_tester.active_tests.get(test_id) else TestStatus.RUNNING,
            config=results["config"],
            start_time=results["start_time"],
            end_time=results["end_time"],
            results=endpoint_results,
            summary=results["summary"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Endpoint to stop an advanced test
@app.post("/api/advanced-test/{test_id}/stop", response_model=TestStopResponse)
async def stop_advanced_test(test_id: str):
    try:
        if stress_tester.stop_test(test_id):
            return TestStopResponse(
                test_id=test_id,
                status=TestStatus.STOPPED,
                stop_time=datetime.now()
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test {test_id} not found or already completed"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@app.websocket("/ws/metrics/{test_id}")
async def metrics_websocket(websocket: WebSocket, test_id: str):
    await metrics_manager.connect_client(test_id, websocket)
    
    try:
        while True:
            await metrics_manager.broadcast_metrics(test_id)
            await asyncio.sleep(1)  # Update every second
    except WebSocketDisconnect:
        await metrics_manager.disconnect_client(test_id, websocket)
    except Exception as e:
        print(f"Error in metrics websocket: {e}")
        await metrics_manager.disconnect_client(test_id, websocket)

@app.get("/api/tests/{test_id}/summary")
async def get_test_summary(test_id: str):
    """Get summary statistics for a test."""
    metrics = metrics_manager.generator.generate_metrics(test_id)
    if not metrics:
        return {
            "totalRequests": 0,
            "activeEndpoints": [],
            "peakConcurrentRequests": 0
        }
    
    return {
        "totalRequests": sum(m.concurrent_requests for m in metrics),
        "activeEndpoints": [m.endpoint for m in metrics],
        "peakConcurrentRequests": max(m.concurrent_requests for m in metrics)
    }

# Endpoint 1: Get all sessions and configurations for a user
@app.get("/api/user/{email}/sessions", response_model=UserSessionsResponse)
async def get_user_sessions(email: str):
    """
    Retrieve configuration info for all sessions associated with a specific user.
    This endpoint currently uses mock data that returns three sessions.
    """
    # Generate mock user ID
    user_id = str(uuid.uuid4())
    
    # Create three mock sessions with configurations
    sessions = []
    for i in range(1, 4):
        session_id = str(uuid.uuid4())
        
        # Create mock configurations for each session
        configurations = []
        for j in range(1, 3):  # 2 configurations per session
            config_id = str(uuid.uuid4())
            configurations.append(
                SessionConfigModel(
                    id=config_id,
                    session_id=session_id,
                    endpoint_url=f"https://api.example.com/endpoint{j}",
                    http_method="GET" if j % 2 == 0 else "POST",
                    request_headers={"Content-Type": "application/json"},
                    request_body={"test": f"data{j}"},
                    request_params={"param1": f"value{j}"},
                    concurrent_users=10 * j,
                    ramp_up_time=5,
                    test_duration=30,
                    think_time=1,
                    success_criteria={"status_code": 200}
                )
            )
        
        # Create mock session with configurations
        sessions.append(
            SessionModel(
                id=session_id,
                name=f"Test Session {i}",
                description=f"This is test session {i}",
                created_at=datetime.now(),
                updated_at=datetime.now(),
                configurations=configurations
            )
        )
    
    # Return mock user response with sessions
    return UserSessionsResponse(
        user_id=user_id,
        email=email,
        sessions=sessions
    )

# Endpoint 2: Create a new session configuration
@app.post("/api/sessions/configuration", response_model=SessionConfigModel)
async def create_session_configuration(config: SessionConfigRequest):
    """
    Publish configuration info into the database.
    This endpoint currently uses mock data and returns the created configuration with a generated ID.
    """
    # Generate mock configuration ID
    config_id = str(uuid.uuid4())
    
    # Return mock configuration with the provided values
    return SessionConfigModel(
        id=config_id,
        session_id=config.session_id,
        endpoint_url=config.endpoint_url,
        http_method=config.http_method,
        request_headers=config.request_headers,
        request_body=config.request_body,
        request_params=config.request_params,
        concurrent_users=config.concurrent_users,
        ramp_up_time=config.ramp_up_time,
        test_duration=config.test_duration,
        think_time=config.think_time,
        success_criteria=config.success_criteria
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
