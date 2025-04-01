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
import json

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
    DistributionRequirementsResponse,
    DataGenerationRequest,
    DataGenerationResponse,
    EndpointDataGenerationRequest,
    TestScenarioGenerationRequest,
    TestScenario,
    EndpointTestDataRequest,
    EndpointTestDataResponse
)
from metrics_generator import metrics_manager
from database.database import get_db
from database.crud import get_user_by_email, get_user_sessions as get_db_user_sessions, get_session_configs, create_session, create_session_config, get_session
from sqlalchemy.orm import Session

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
        
        # Result structure
        result = {
            "endpoint": f"{endpoint.method} {endpoint.path}",
            "summary": endpoint.summary,
            "description": endpoint.description,
            "samples": {}
        }
        
        # Generate header parameters
        headers = {}
        header_params = [p for p in endpoint.parameters if p.location == 'header']
        if header_params:
            for param in header_params:
                if param.param_schema:
                    headers[param.name] = data_generator.generate_primitive(
                        param.param_schema.get('type', 'string'),
                        param.param_schema.get('format'),
                        param.param_schema.get('enum')
                    )
            result["samples"]["headers"] = headers
        
        # Generate path parameters
        path_params = {}
        path_param_list = [p for p in endpoint.parameters if p.location == 'path']
        if path_param_list:
            for param in path_param_list:
                if param.param_schema:
                    path_params[param.name] = data_generator.generate_primitive(
                        param.param_schema.get('type', 'string'),
                        param.param_schema.get('format'),
                        param.param_schema.get('enum')
                    )
            result["samples"]["path_parameters"] = path_params
        
        # Generate query parameters
        query_params = {}
        query_param_list = [p for p in endpoint.parameters if p.location == 'query']
        if query_param_list:
            for param in query_param_list:
                if param.param_schema:
                    query_params[param.name] = data_generator.generate_primitive(
                        param.param_schema.get('type', 'string'),
                        param.param_schema.get('format'),
                        param.param_schema.get('enum')
                    )
            result["samples"]["query_parameters"] = query_params
        
        # Generate request body if available
        if endpoint.request_body:
            result["samples"]["request_body"] = data_generator.generate_request_data(endpoint.request_body)
        
        # Generate example URL with path parameters filled in
        path_with_params = endpoint.path
        if path_params:
            for param_name, param_value in path_params.items():
                path_with_params = path_with_params.replace(f"{{{param_name}}}", str(param_value))
        
        # Add query parameters to URL if present
        if query_params:
            query_string = "&".join([f"{k}={v}" for k, v in query_params.items()])
            path_with_params = f"{path_with_params}?{query_string}"
        
        result["example_url"] = path_with_params
        
        # Generate example curl command
        curl_cmd = f"curl -X {endpoint.method} "
        
        # Add headers to curl command
        if headers:
            for header_name, header_value in headers.items():
                curl_cmd += f"-H '{header_name}: {header_value}' "
        
        # Add a placeholder authorization header for the example
        curl_cmd += "-H 'Authorization: Bearer YOUR_TOKEN_HERE' "
        
        # Add request body to curl command if needed
        if endpoint.method in ['POST', 'PUT', 'PATCH'] and "request_body" in result["samples"]:
            curl_cmd += f"-d '{json.dumps(result['samples']['request_body'])}' "
        
        # Complete the curl command with URL
        curl_cmd += f"'{{base_url}}{path_with_params}'"
        
        result["curl_example"] = curl_cmd
        
        return result
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
async def get_user_sessions(email: str, db: Session = Depends(get_db)):
    """
    Retrieve configuration info for all sessions associated with a specific user.
    This endpoint queries the database for user sessions and their configurations.
    """
    try:
        # Get user by email
        user = get_user_by_email(db, email)
        if not user:
            raise HTTPException(status_code=404, detail=f"User with email {email} not found")
        
        # Get all sessions for the user
        db_sessions = get_db_user_sessions(db, user.id)
        
        # Convert database sessions to API response model
        sessions = []
        for db_session in db_sessions:
            # Get configurations for this session
            db_configs = get_session_configs(db, db_session.id)
            
            # Convert database configurations to API response model
            configurations = []
            for db_config in db_configs:
                config = SessionConfigModel(
                    id=str(db_config.id),
                    session_id=str(db_config.session_id),
                    endpoint_url=db_config.endpoint_url,
                    http_method=db_config.http_method,
                    request_headers=db_config.request_headers,
                    request_body=db_config.request_body,
                    request_params=db_config.request_params,
                    concurrent_users=db_config.concurrent_users,
                    ramp_up_time=db_config.ramp_up_time,
                    test_duration=db_config.test_duration,
                    think_time=db_config.think_time,
                    success_criteria=db_config.success_criteria
                )
                configurations.append(config)
            
            # Create session model with configurations
            session = SessionModel(
                id=str(db_session.id),
                name=db_session.name,
                description=db_session.description,
                created_at=db_session.created_at,
                updated_at=db_session.updated_at,
                configurations=configurations
            )
            sessions.append(session)
        
        # Return user response with sessions
        return UserSessionsResponse(
            user_id=str(user.id),
            email=user.email,
            sessions=sessions
        )
    except HTTPException as he:
        # Re-raise HTTP exceptions
        raise he
    except Exception as e:
        # Log the error for debugging
        logger.error(f"Error in get_user_sessions: {str(e)}")
        # Raise an HTTP exception
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Endpoint 2: Create a new session configuration
@app.post("/api/sessions/configuration", response_model=SessionConfigModel)
async def create_session_configuration(config: SessionConfigRequest, user_email: str, db: Session = Depends(get_db)):
    """
    Create a new session configuration for a user and store it in the database.
    
    This endpoint:
    1. Finds the user by email
    2. Creates a new session if session_id is not provided
    3. Creates a session configuration linked to the session
    
    Returns the created configuration with a generated ID.
    """
    try:
        # Find the user by email
        user = get_user_by_email(db, user_email)
        if not user:
            raise HTTPException(status_code=404, detail=f"User with email {user_email} not found")
        
        # Check if session exists or create a new one
        session = None
        if config.session_id and config.session_id != "new":
            # Try to get the existing session
            try:
                session_uuid = uuid.UUID(config.session_id)
                session = get_session(db, session_uuid)
                
                # Verify the session belongs to the user
                if session and str(session.user_id) != str(user.id):
                    raise HTTPException(
                        status_code=403, 
                        detail="Session does not belong to the specified user"
                    )
            except ValueError:
                # Invalid UUID format
                raise HTTPException(status_code=400, detail="Invalid session ID format")
        
        # Create a new session if needed
        if not session:
            # Generate a default session name if not provided
            session_name = f"Test Session {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            session_description = f"Configuration for {config.endpoint_url}"
            
            # Create the session
            session = create_session(db, user.id, session_name, session_description)
            logger.info(f"Created new session {session.id} for user {user_email}")
        
        # Create the session configuration
        session_config = create_session_config(
            db=db,
            session_id=session.id,
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
        
        # Return the created configuration
        return SessionConfigModel(
            id=str(session_config.id),
            session_id=str(session_config.session_id),
            endpoint_url=session_config.endpoint_url,
            http_method=session_config.http_method,
            request_headers=session_config.request_headers,
            request_body=session_config.request_body,
            request_params=session_config.request_params,
            concurrent_users=session_config.concurrent_users,
            ramp_up_time=session_config.ramp_up_time,
            test_duration=session_config.test_duration,
            think_time=session_config.think_time,
            success_criteria=session_config.success_criteria
        )
    except HTTPException as he:
        # Re-raise HTTP exceptions
        raise he
    except Exception as e:
        # Log the error for debugging
        logger.error(f"Error in create_session_configuration: {str(e)}")
        # Rollback the transaction in case of error
        db.rollback()
        # Raise an HTTP exception
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Endpoint to generate data based on schema
@app.post("/api/generate-data", response_model=DataGenerationResponse)
async def generate_data(request: DataGenerationRequest):
    """Generate sample data based on the provided schema definition."""
    try:
        # Initialize the data generator
        data_generator = RequestDataGenerator()
        generated_data = None
        
        # Generate data based on the schema type
        if request.schema_type in ['string', 'integer', 'number', 'boolean']:
            # For primitive types
            if request.count == 1:
                generated_data = data_generator.generate_primitive(
                    request.schema_type, 
                    request.schema_format, 
                    request.enum
                )
            else:
                # Generate multiple samples if requested
                generated_data = [
                    data_generator.generate_primitive(
                        request.schema_type, 
                        request.schema_format, 
                        request.enum
                    ) for _ in range(request.count)
                ]
        elif request.schema_type == 'object' and request.schema:
            # For object types
            if request.count == 1:
                generated_data = data_generator.generate_object(request.schema)
            else:
                generated_data = [
                    data_generator.generate_object(request.schema)
                    for _ in range(request.count)
                ]
        elif request.schema_type == 'array' and request.schema:
            # For array types
            if request.count == 1:
                generated_data = data_generator.generate_array(request.schema)
            else:
                generated_data = [
                    data_generator.generate_array(request.schema)
                    for _ in range(request.count)
                ]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid schema type or missing schema definition"
            )
            
        return DataGenerationResponse(
            generated_data=generated_data,
            count=request.count,
            schema_type=request.schema_type
        )
    except Exception as e:
        logger.error(f"Error generating data: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error generating data: {str(e)}"
        )

# Endpoint to generate data for a specific API endpoint
@app.post("/api/endpoint-data")
async def generate_endpoint_data(request: EndpointDataGenerationRequest):
    """Generate sample data for a specific API endpoint."""
    try:
        data_generator = RequestDataGenerator()
        
        # Result data structure
        result_samples = []
        
        for _ in range(request.count):
            sample = {
                "endpoint": f"{request.endpoint_schema.method} {request.endpoint_schema.path}",
                "data": {}
            }
            
            # Generate path parameters
            if request.include_path:
                path_params = {}
                for param in request.endpoint_schema.parameters:
                    if param.location == 'path' and param.param_schema:
                        param_type = param.param_schema.get('type', 'string')
                        param_format = param.param_schema.get('format')
                        param_enum = param.param_schema.get('enum')
                        path_params[param.name] = data_generator.generate_primitive(param_type, param_format, param_enum)
                if path_params:
                    sample["data"]["path_parameters"] = path_params
            
            # Generate query parameters
            if request.include_query:
                query_params = {}
                for param in request.endpoint_schema.parameters:
                    if param.location == 'query' and param.param_schema:
                        param_type = param.param_schema.get('type', 'string')
                        param_format = param.param_schema.get('format')
                        param_enum = param.param_schema.get('enum')
                        query_params[param.name] = data_generator.generate_primitive(param_type, param_format, param_enum)
                if query_params:
                    sample["data"]["query_parameters"] = query_params
            
            # Generate header parameters
            if request.include_headers:
                headers = {}
                for param in request.endpoint_schema.parameters:
                    if param.location == 'header' and param.param_schema:
                        param_type = param.param_schema.get('type', 'string')
                        param_format = param.param_schema.get('format')
                        param_enum = param.param_schema.get('enum')
                        headers[param.name] = data_generator.generate_primitive(param_type, param_format, param_enum)
                if headers:
                    sample["data"]["headers"] = headers
            
            # Generate request body
            if request.include_body and request.endpoint_schema.request_body:
                sample["data"]["body"] = data_generator.generate_request_data(request.endpoint_schema.request_body)
            
            # Generate example URL with path parameters filled in
            path_with_params = request.endpoint_schema.path
            if request.include_path and "path_parameters" in sample["data"]:
                for param_name, param_value in sample["data"]["path_parameters"].items():
                    path_with_params = path_with_params.replace(f"{{{param_name}}}", str(param_value))
            sample["example_url"] = path_with_params
            
            # Generate example curl command
            if request.endpoint_schema.method != "GET":
                curl_cmd = f"curl -X {request.endpoint_schema.method} "
                
                # Add headers
                if request.include_headers and "headers" in sample["data"]:
                    for header_name, header_value in sample["data"]["headers"].items():
                        curl_cmd += f"-H '{header_name}: {header_value}' "
                
                # Add authorization header placeholder
                curl_cmd += "-H 'Authorization: Bearer YOUR_TOKEN' "
                
                # Add body
                if request.include_body and "body" in sample["data"]:
                    curl_cmd += f"-d '{json.dumps(sample['data']['body'])}' "
                
                # Add URL with query params
                url = path_with_params
                if request.include_query and "query_parameters" in sample["data"]:
                    url += "?" + "&".join([f"{k}={v}" for k, v in sample["data"]["query_parameters"].items()])
                
                curl_cmd += f"'{{api_base_url}}{url}'"
                sample["example_curl"] = curl_cmd
            
            result_samples.append(sample)
        
        return {
            "count": request.count,
            "endpoint": f"{request.endpoint_schema.method} {request.endpoint_schema.path}",
            "samples": result_samples,
            "timestamp": datetime.now()
        }
    except Exception as e:
        logger.error(f"Error generating endpoint data: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error generating endpoint data: {str(e)}"
        )

# Endpoint to generate test data for a UI endpoint with specific format
@app.post("/api/endpoint-test-data", response_model=EndpointTestDataResponse)
async def generate_endpoint_test_data(request: EndpointTestDataRequest):
    """Generate test data samples for a specific endpoint in the format needed by the UI."""
    try:
        data_generator = RequestDataGenerator()
        
        # Result data samples
        data_samples = []
        
        # Get the method and path from the endpoint key
        method, path = request.endpoint_key.split(' ', 1)
        
        for _ in range(request.sample_count):
            # Create a sample with all types of parameters
            sample = {}
            
            # Generate path parameters
            path_params = {}
            for param in request.endpoint_schema.parameters:
                if param.location == 'path' and param.param_schema:
                    param_type = param.param_schema.get('type', 'string')
                    param_format = param.param_schema.get('format')
                    param_enum = param.param_schema.get('enum')
                    path_params[param.name] = data_generator.generate_primitive(param_type, param_format, param_enum)
            if path_params:
                sample["path_parameters"] = path_params
            
            # Generate query parameters
            query_params = {}
            for param in request.endpoint_schema.parameters:
                if param.location == 'query' and param.param_schema:
                    param_type = param.param_schema.get('type', 'string')
                    param_format = param.param_schema.get('format')
                    param_enum = param.param_schema.get('enum')
                    query_params[param.name] = data_generator.generate_primitive(param_type, param_format, param_enum)
            if query_params:
                sample["query_parameters"] = query_params
            
            # Generate header parameters
            headers = {}
            for param in request.endpoint_schema.parameters:
                if param.location == 'header' and param.param_schema:
                    param_type = param.param_schema.get('type', 'string')
                    param_format = param.param_schema.get('format')
                    param_enum = param.param_schema.get('enum')
                    headers[param.name] = data_generator.generate_primitive(param_type, param_format, param_enum)
            if headers:
                sample["headers"] = headers
            
            # Generate request body
            if request.endpoint_schema.request_body:
                sample["body"] = data_generator.generate_request_data(request.endpoint_schema.request_body)
            
            # Add the sample to the result
            data_samples.append(sample)
        
        return EndpointTestDataResponse(
            endpoint_key=request.endpoint_key,
            data_samples=data_samples
        )
        
    except Exception as e:
        logger.error(f"Error generating endpoint test data: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error generating endpoint test data: {str(e)}"
        )

# Endpoint to generate complete test scenarios
@app.post("/api/generate-test-scenarios", response_model=List[TestScenario])
async def generate_test_scenarios(request: TestScenarioGenerationRequest):
    """Generate complete test scenarios for the provided API endpoints."""
    try:
        data_generator = RequestDataGenerator()
        scenarios = []
        
        # Common API patterns for scenario generation
        scenario_templates = [
            {
                "name": "Basic CRUD Operations",
                "description": "Tests the fundamental Create, Read, Update, Delete operations",
                "type": "crud"
            },
            {
                "name": "Authentication and Authorization",
                "description": "Tests user authentication flow and permission checks",
                "type": "auth"
            },
            {
                "name": "Data Validation and Error Handling",
                "description": "Tests API's response to invalid inputs and edge cases",
                "type": "validation"
            },
            {
                "name": "Performance Under Load",
                "description": "Tests API's behavior with high volume of concurrent requests",
                "type": "performance"
            },
            {
                "name": "Complex Business Workflow",
                "description": "Tests a multi-step business process from start to finish",
                "type": "workflow"
            }
        ]
        
        # Filter endpoints by method type
        get_endpoints = [e for e in request.endpoints if e.method == 'GET']
        post_endpoints = [e for e in request.endpoints if e.method == 'POST']
        put_endpoints = [e for e in request.endpoints if e.method == 'PUT' or e.method == 'PATCH']
        delete_endpoints = [e for e in request.endpoints if e.method == 'DELETE']
        
        # Generate the requested number of scenarios
        for i in range(request.scenario_count):
            # Select a scenario template
            template = scenario_templates[i % len(scenario_templates)]
            
            # Generate scenario name if more than the template count
            scenario_name = template["name"]
            if i >= len(scenario_templates):
                scenario_name += f" (Variation {i // len(scenario_templates) + 1})"
            
            scenario = {
                "name": scenario_name,
                "description": template["description"],
                "endpoints": [],
                "dependencies": [],
                "workflow": []
            }
            
            # Add endpoints based on scenario type
            if template["type"] == "crud":
                # For CRUD, we want POST, GET, PUT, DELETE operations
                endpoints_to_use = []
                
                # Try to find endpoints matching CRUD pattern
                if post_endpoints:
                    endpoints_to_use.append(random.choice(post_endpoints))  # Create
                if get_endpoints:
                    endpoints_to_use.append(random.choice(get_endpoints))   # Read
                if put_endpoints:
                    endpoints_to_use.append(random.choice(put_endpoints))   # Update
                if delete_endpoints:
                    endpoints_to_use.append(random.choice(delete_endpoints)) # Delete
                
                # Generate sample data for each endpoint
                for endpoint in endpoints_to_use:
                    endpoint_data = await generate_sample_data(endpoint)
                    scenario["endpoints"].append(endpoint_data)
                
                # Add dependencies
                if request.include_dependencies and len(endpoints_to_use) > 1:
                    # Create -> Read -> Update -> Delete dependency chain
                    for i in range(len(endpoints_to_use) - 1):
                        scenario["dependencies"].append({
                            "source": f"{endpoints_to_use[i].method} {endpoints_to_use[i].path}",
                            "target": f"{endpoints_to_use[i+1].method} {endpoints_to_use[i+1].path}",
                            "type": "sequential"
                        })
                
                # Add workflow
                if request.include_workflows and len(endpoints_to_use) > 0:
                    scenario["workflow"] = [f"{e.method} {e.path}" for e in endpoints_to_use]
            
            elif template["type"] == "auth":
                # For auth scenario, focus on POST auth endpoints and GET protected resources
                auth_endpoints = [e for e in post_endpoints if any(auth_term in e.path.lower() for auth_term in ["auth", "login", "token"])]
                protected_endpoints = get_endpoints[:2] if len(get_endpoints) > 2 else get_endpoints  # Take 2 GET endpoints or all if less than 2
                
                endpoints_to_use = auth_endpoints + protected_endpoints
                
                # If no auth endpoints found, use any POST endpoint as a substitute
                if not auth_endpoints and post_endpoints:
                    endpoints_to_use = [post_endpoints[0]] + protected_endpoints
                
                # Generate sample data for each endpoint
                for endpoint in endpoints_to_use:
                    endpoint_data = await generate_sample_data(endpoint)
                    scenario["endpoints"].append(endpoint_data)
                
                # Add dependencies
                if request.include_dependencies and len(endpoints_to_use) > 1:
                    # Auth -> Protected Resource dependency
                    for i in range(1, len(endpoints_to_use)):
                        scenario["dependencies"].append({
                            "source": f"{endpoints_to_use[0].method} {endpoints_to_use[0].path}",
                            "target": f"{endpoints_to_use[i].method} {endpoints_to_use[i].path}",
                            "type": "authentication"
                        })
                
                # Add workflow
                if request.include_workflows and len(endpoints_to_use) > 0:
                    scenario["workflow"] = [f"{e.method} {e.path}" for e in endpoints_to_use]
            
            elif template["type"] == "validation":
                # Choose a few endpoints for validation testing
                endpoints_to_use = []
                
                # Prefer endpoints with more parameters or request bodies
                complex_endpoints = [e for e in request.endpoints if len(e.parameters) > 1 or e.request_body]
                
                if complex_endpoints:
                    # Use up to 3 complex endpoints
                    endpoints_to_use = complex_endpoints[:3] if len(complex_endpoints) > 3 else complex_endpoints
                else:
                    # Fallback to any available endpoints
                    endpoints_to_use = request.endpoints[:3] if len(request.endpoints) > 3 else request.endpoints
                
                # Generate sample data for each endpoint
                for endpoint in endpoints_to_use:
                    endpoint_data = await generate_sample_data(endpoint)
                    
                    # For validation testing, add some examples of invalid data
                    if endpoint.parameters or endpoint.request_body:
                        endpoint_data["invalid_examples"] = []
                        
                        # Generate invalid path parameters (if any)
                        if "path_parameters" in endpoint_data["samples"]:
                            invalid_path = {**endpoint_data["samples"]["path_parameters"]}
                            for key in invalid_path:
                                # Make the parameter invalid by using wrong type
                                if isinstance(invalid_path[key], str):
                                    invalid_path[key] = 999999
                                elif isinstance(invalid_path[key], (int, float)):
                                    invalid_path[key] = "invalid_value"
                            
                            endpoint_data["invalid_examples"].append({
                                "type": "invalid_path_params",
                                "data": invalid_path
                            })
                        
                        # Generate invalid request body (if any)
                        if "request_body" in endpoint_data["samples"]:
                            invalid_body = {**endpoint_data["samples"]["request_body"]}
                            
                            # 1. Missing required fields example
                            if invalid_body:
                                missing_field = list(invalid_body.keys())[0]
                                invalid_body_missing = {k: v for k, v in invalid_body.items() if k != missing_field}
                                endpoint_data["invalid_examples"].append({
                                    "type": "missing_required_field",
                                    "field": missing_field,
                                    "data": invalid_body_missing
                                })
                            
                            # 2. Invalid data type example
                            if invalid_body:
                                field_to_invalidate = list(invalid_body.keys())[0]
                                invalid_body_type = {**invalid_body}
                                if isinstance(invalid_body_type[field_to_invalidate], str):
                                    invalid_body_type[field_to_invalidate] = 12345
                                elif isinstance(invalid_body_type[field_to_invalidate], (int, float)):
                                    invalid_body_type[field_to_invalidate] = "not_a_number"
                                elif isinstance(invalid_body_type[field_to_invalidate], bool):
                                    invalid_body_type[field_to_invalidate] = "not_a_boolean"
                                
                                endpoint_data["invalid_examples"].append({
                                    "type": "invalid_data_type",
                                    "field": field_to_invalidate,
                                    "data": invalid_body_type
                                })
                            
                            # 3. Extremely long value example
                            if invalid_body:
                                field_to_invalidate = list(invalid_body.keys())[0]
                                invalid_body_too_long = {**invalid_body}
                                invalid_body_too_long[field_to_invalidate] = "x" * 10000
                                
                                endpoint_data["invalid_examples"].append({
                                    "type": "value_too_long",
                                    "field": field_to_invalidate,
                                    "data": invalid_body_too_long
                                })
                    
                    scenario["endpoints"].append(endpoint_data)
                
                # No dependencies for validation scenarios
                # But we can still add workflow
                if request.include_workflows and len(endpoints_to_use) > 0:
                    scenario["workflow"] = [f"{e.method} {e.path}" for e in endpoints_to_use]
            
            elif template["type"] == "performance":
                # For performance testing, choose a mix of read and write endpoints
                endpoints_to_use = []
                
                # Add a mix of GET and POST/PUT endpoints
                if get_endpoints:
                    endpoints_to_use.extend(get_endpoints[:2] if len(get_endpoints) > 2 else get_endpoints)
                if post_endpoints:
                    endpoints_to_use.extend(post_endpoints[:1] if len(post_endpoints) > 1 else post_endpoints)
                if put_endpoints:
                    endpoints_to_use.extend(put_endpoints[:1] if len(put_endpoints) > 1 else put_endpoints)
                
                # Generate sample data for each endpoint
                for endpoint in endpoints_to_use:
                    endpoint_data = await generate_sample_data(endpoint)
                    
                    # Add performance test specific metadata
                    endpoint_data["performance_config"] = {
                        "concurrent_users": [10, 50, 100, 200, 500],
                        "duration_seconds": 60,
                        "ramp_up_time": 10,
                        "think_time_ms": 100
                    }
                    
                    scenario["endpoints"].append(endpoint_data)
                
                # No dependencies for performance scenarios
                # But we can still add workflow
                if request.include_workflows and len(endpoints_to_use) > 0:
                    scenario["workflow"] = [f"{e.method} {e.path}" for e in endpoints_to_use]
            
            elif template["type"] == "workflow":
                # For workflow testing, try to build a logical sequence
                # First, look for endpoints that could represent a business process
                
                # Step 1: Look for endpoints that may represent creating a resource
                create_endpoints = [e for e in post_endpoints if not any(auth_term in e.path.lower() for auth_term in ["auth", "login", "token"])]
                
                # Step 2: Find endpoints that might get a list or specific resource
                get_resource_endpoints = get_endpoints
                
                # Step 3: Find endpoints for updating a resource
                update_endpoints = put_endpoints
                
                # Combine in a logical order
                endpoints_to_use = []
                
                # Add create endpoint if available
                if create_endpoints:
                    endpoints_to_use.append(random.choice(create_endpoints))
                
                # Add get endpoint if available
                if get_resource_endpoints:
                    endpoints_to_use.append(random.choice(get_resource_endpoints))
                
                # Add update endpoint if available
                if update_endpoints:
                    endpoints_to_use.append(random.choice(update_endpoints))
                
                # Add another get to verify the update
                if get_resource_endpoints and len(get_resource_endpoints) > 1:
                    second_get = random.choice([e for e in get_resource_endpoints if e != endpoints_to_use[1]])
                    endpoints_to_use.append(second_get)
                elif get_resource_endpoints:
                    endpoints_to_use.append(get_resource_endpoints[0])
                
                # Generate sample data for each endpoint
                for endpoint in endpoints_to_use:
                    endpoint_data = await generate_sample_data(endpoint)
                    scenario["endpoints"].append(endpoint_data)
                
                # Add dependencies
                if request.include_dependencies and len(endpoints_to_use) > 1:
                    # Create a chain of dependencies
                    for i in range(len(endpoints_to_use) - 1):
                        dependency_type = "data_flow"
                        if i == 0:
                            dependency_type = "creation_to_retrieval"
                        elif i == 1 and len(endpoints_to_use) > 2:
                            dependency_type = "retrieval_to_update"
                        
                        scenario["dependencies"].append({
                            "source": f"{endpoints_to_use[i].method} {endpoints_to_use[i].path}",
                            "target": f"{endpoints_to_use[i+1].method} {endpoints_to_use[i+1].path}",
                            "type": dependency_type
                        })
                
                # Add workflow
                if request.include_workflows and len(endpoints_to_use) > 0:
                    scenario["workflow"] = [f"{e.method} {e.path}" for e in endpoints_to_use]
            
            scenarios.append(TestScenario(**scenario))
        
        return scenarios
    except Exception as e:
        logger.error(f"Error generating test scenarios: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error generating test scenarios: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
