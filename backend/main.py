from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends, status
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import uuid
from datetime import datetime
import httpx
import asyncio
import logging
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import random

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
    DistributionStrategy,
    DistributionRequirementsResponse
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
    allow_origins=["http://localhost:5173"],  # Frontend development server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize stress tester
stress_tester = StressTester()

# Distribution strategies requirements - can be moved to a separate file for better organization
class RequirementField(BaseModel):
    type: str
    label: str
    description: str
    default_value: Any
    min: Optional[int] = None
    max: Optional[int] = None
    required: bool = True

class EndpointRequirement(BaseModel):
    type: str
    description: str
    must_total: int
    default_distribution: str

class StrategyRequirements(BaseModel):
    name: str
    description: str
    general_requirements: Dict[str, RequirementField]
    endpoint_specific_requirements: bool
    endpoint_requirements: Optional[EndpointRequirement] = None

distribution_requirements = {
    "sequential": StrategyRequirements(
        name="Sequential Testing",
        description="Requests are sent one after another in order",
        general_requirements={
            "delay_between_requests_ms": RequirementField(
                type="number",
                label="Delay between requests (ms)",
                description="Time to wait between consecutive requests in milliseconds",
                default_value=0,
                min=0,
                max=10000
            ),
            "repeat_sequence": RequirementField(
                type="number",
                label="Repeat count",
                description="Number of times to repeat the sequence of endpoints",
                default_value=1,
                min=1,
                max=100
            )
        },
        endpoint_specific_requirements=False
    ),
    "interleaved": StrategyRequirements(
        name="Interleaved Testing",
        description="Requests are distributed evenly across endpoints",
        general_requirements={},
        endpoint_specific_requirements=True,
        endpoint_requirements=EndpointRequirement(
            type="percentage",
            description="Set the percentage of requests for each endpoint. Total must equal 100%.",
            must_total=100,
            default_distribution="even"
        )
    ),
    "random": StrategyRequirements(
        name="Random Distribution",
        description="Requests are sent randomly to selected endpoints",
        general_requirements={
            "seed": RequirementField(
                type="number",
                label="Seed",
                description="Random seed for reproducibility (optional)",
                default_value=None,
                required=False
            ),
            "distribution_pattern": RequirementField(
                type="select",
                label="Distribution pattern",
                description="Pattern to use for distributing requests",
                default_value="uniform",
                options=["uniform", "weighted", "gaussian"]
            )
        },
        endpoint_specific_requirements=False
    )
}

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

# Endpoint to get available distribution strategies
@app.get("/api/distribution-strategies", response_model=List[str])
async def get_distribution_strategies():
    """
    Returns all available distribution strategies for stress testing.
    
    Returns:
        List[DistributionStrategy]: A list of all available distribution strategies.
    """
    return [strategy.value for strategy in DistributionStrategy]

# Endpoint to get distribution strategy requirements
@app.get("/api/distribution-requirements", response_model=DistributionRequirementsResponse)
async def get_distribution_requirements():
    """
    Returns detailed requirements for each distribution strategy.
    
    These requirements define what configuration options are available for each strategy,
    including both general strategy options and endpoint-specific requirements.
    
    Returns:
        DistributionRequirementsResponse: Requirements for all available distribution strategies.
    """
    return DistributionRequirementsResponse(strategies=distribution_requirements)

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

# Add a dictionary to store the current state of each test
test_progress = {}

@app.get("/api/tests/{test_id}/summary")
async def get_test_summary(test_id: str):
    """Get summary statistics for a test."""
    metrics = metrics_manager.generator.generate_metrics(test_id)
    
    # List of sample endpoints to show
    sample_endpoints = [
        "GET /api/users",
        "POST /api/orders",
        "GET /api/products",
        "PUT /api/user/profile"
    ]
    
    # Define the progression of concurrent request levels
    all_concurrent_levels = [5, 10, 20, 50, 100]
    
    # Initialize test state if this is a new test
    if test_id not in test_progress:
        # Start with just the first level
        test_progress[test_id] = {
            "current_level_index": 0,  # Start with the first level (5 concurrent users)
            "metrics": {},  # Store metrics to keep them consistent
            "last_update": datetime.now()
        }
    
    # Get the current state for this test
    test_state = test_progress[test_id]
    
    # Every few seconds, advance to the next level (simulating test progress)
    current_time = datetime.now()
    seconds_since_last_update = (current_time - test_state["last_update"]).total_seconds()
    if seconds_since_last_update > 3 and test_state["current_level_index"] < len(all_concurrent_levels) - 1:
        test_state["current_level_index"] += 1
        test_state["last_update"] = current_time
    
    # Get the current available levels based on progress
    current_max_index = test_state["current_level_index"]
    available_levels = all_concurrent_levels[:current_max_index + 1]
    
    # Generate detailed metrics across available concurrent user levels
    detailed_metrics = []
    total_requests = 0
    peak_concurrent = 0
    
    for endpoint in sample_endpoints:
        # For each endpoint, generate metrics at each available concurrent level
        for concurrent_requests in available_levels:
            # Create a unique key for this endpoint + concurrency level
            metric_key = f"{endpoint}_{concurrent_requests}"
            
            # If we already have metrics for this combination, use them
            # This ensures consistency in the data
            if metric_key in test_state["metrics"]:
                metric = test_state["metrics"][metric_key]
                detailed_metrics.append(metric)
                
                # Update totals
                total_requests += metric["concurrentRequests"]
                peak_concurrent = max(peak_concurrent, metric["concurrentRequests"])
                continue
            
            # Generate new metrics for this endpoint and concurrency level
            total_requests += concurrent_requests
            peak_concurrent = max(peak_concurrent, concurrent_requests)
            
            # Calculate success rate (decreasing as load increases)
            base_success_rate = random.uniform(0.95, 1.0)  # Start with high success rate
            load_factor = concurrent_requests / 100  # Higher loads affect success more
            success_rate = max(0.7, base_success_rate - (load_factor * random.uniform(0.05, 0.25)))
            
            success_count = int(concurrent_requests * success_rate)
            failure_count = concurrent_requests - success_count
            
            # Generate response times that increase with load
            base_response_time = random.uniform(30, 100)  # Base time in ms
            load_multiplier = 1 + (concurrent_requests / 20)  # Scales with load
            jitter = random.uniform(0.8, 1.2)  # Add variation
            
            avg_response_time = base_response_time * load_multiplier * jitter
            min_response_time = avg_response_time * random.uniform(0.6, 0.9)
            max_response_time = avg_response_time * random.uniform(1.5, 5.0 if concurrent_requests > 50 else 3.0)
            
            # Generate status code distribution
            status_codes = {}
            
            # Success codes (2xx)
            status_codes["200"] = success_count - random.randint(0, min(5, success_count))
            if "200" in status_codes and status_codes["200"] < success_count:
                status_codes["201"] = random.randint(0, success_count - status_codes["200"])
                status_codes["204"] = success_count - status_codes["200"] - status_codes.get("201", 0)
            
            # Error codes (4xx, 5xx) - more errors at higher loads
            if failure_count > 0:
                # More server errors (5xx) as load increases
                error_codes = ["400", "401", "404"] if concurrent_requests < 50 else ["400", "429", "500", "502", "504"]
                for _ in range(failure_count):
                    code = random.choice(error_codes)
                    status_codes[code] = status_codes.get(code, 0) + 1
            
            # Create detailed metric object
            detailed_metric = {
                "endpoint": endpoint,
                "concurrentRequests": concurrent_requests,
                "successCount": success_count,
                "failureCount": failure_count,
                "successRate": success_rate,
                "responseTime": {
                    "avg": avg_response_time,
                    "min": min_response_time,
                    "max": max_response_time
                },
                "statusCodes": status_codes,
                "timestamp": datetime.now().isoformat(),
                "errorMessage": "Service degraded under load" if concurrent_requests > 50 and failure_count > 10 else None
            }
            
            # Store the metric for consistency in future calls
            test_state["metrics"][metric_key] = detailed_metric
            
            # Add to the result list
            detailed_metrics.append(detailed_metric)
    
    # Return combined metrics, showing progression
    progress_percentage = ((current_max_index + 1) / len(all_concurrent_levels)) * 100
    
    return {
        "totalRequests": total_requests,
        "activeEndpoints": sample_endpoints,
        "peakConcurrentRequests": peak_concurrent,
        "detailedMetrics": detailed_metrics,
        "testProgress": {
            "currentLevel": available_levels[-1],
            "maxLevel": all_concurrent_levels[-1],
            "progressPercentage": progress_percentage,
            "completedLevels": available_levels
        }
    }

# Endpoint 1: Get all sessions and configurations for a user
@app.get("/api/user/{email}/sessions", response_model=UserSessionsResponse)
async def get_user_sessions(email: str):
    """
    Retrieve configuration info for all sessions associated with a specific user.
    This endpoint currently uses mock data that returns three sessions with the TestConfigRequest schema.
    """
    try:
        # Generate mock user ID
        user_id = email
        
        # Create three mock sessions with configurations
        sessions = []
        
        # Target URLs as specified
        target_urls = [
            "https://www.google.com",
            "https://www.amazon.com",
            "https://www.barnesandnoble.com"
        ]
        
        # Distribution strategies
        distribution_strategies = ["sequential", "interleaved", "random"]
        
        for i in range(1, 4):
            # Use the URL as the session ID instead of UUID
            session_id = target_urls[i-1]
            
            # Create mock configurations for each session
            configurations = []
            
            # Use the endpoint URL as the identifier instead of UUID
            config_id = target_urls[i-1]
            
            # Create different concurrent requests for variety
            concurrent_requests = 10 * i
            
            # Create mock endpoint configurations as specified in the schema
            endpoint_paths = [f"/api/resource{i}", f"/api/resource{i}/create"]
            endpoints = [f"GET {endpoint_paths[0]}", f"POST {endpoint_paths[1]}"]
            
            # Create mock headers
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer token-{i}"
            }
            
            # Create a TestConfigRequest object for the success_criteria
            test_config = TestConfigRequest(
                target_url=target_urls[i-1],
                concurrent_users=concurrent_requests,
                request_rate=10,  # Default value as specified
                duration=60,      # Default value as specified
                endpoints=endpoints,
                headers=headers,
                payload_data={"test": f"data{i}"}
            )
            
            # Create a configuration that uses TestConfigRequest
            configurations.append(
                SessionConfigModel(
                    id=config_id,
                    session_id=session_id,
                    endpoint_url=target_urls[i-1],
                    http_method="GET",
                    request_headers=headers,
                    request_body={"test": f"data{i}"},
                    request_params={"param1": f"value{i}"},
                    concurrent_users=concurrent_requests,
                    ramp_up_time=5,
                    test_duration=60,
                    think_time=1,
                    success_criteria=test_config.dict()
                )
            )
            
            # Create mock session with configurations
            sessions.append(
                SessionModel(
                    id=session_id,
                    name=f"Test Session {i}",
                    description=f"Test session for {target_urls[i-1]}",
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                    configurations=configurations
                )
            )
        
        # Return mock user response with sessions
        return UserSessionsResponse(
            user_id=email,
            email=email,
            sessions=sessions
        )
    except Exception as e:
        # Log the error for debugging
        print(f"Error in get_user_sessions: {str(e)}")
        # Re-raise the exception to let FastAPI handle it
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

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
