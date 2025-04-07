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
    EndpointTestDataResponse,
    TestResultModel,  # New import
    TestResultsFilterRequest,  # New import
    TestResultsResponse  # New import
)
from metrics_generator import metrics_manager
from database.database import get_db
from database.crud import (
    get_user_by_email, 
    get_user_sessions as get_db_user_sessions, 
    get_session_configs, 
    create_session, 
    create_session_config, 
    get_session,
    create_test_result,  # New import
    get_test_result,  # New import
    get_test_result_by_test_id,  # New import
    get_config_test_results,  # New import
    get_session_test_results,  # New import
    get_user_test_results,  # New import
    get_filtered_user_test_results,  # New import
    get_filtered_user_test_results_count,  # New import
    update_test_result  # New import
)
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
@app.post("/api/test/start", response_model=TestStartResponse)
async def start_test(config: TestConfigRequest, db: Session = Depends(get_db)):
    try:
        test_id = str(uuid.uuid4())
        
        # Store test configuration in the database if a session_id is provided
        session_config = None
        if hasattr(config, 'session_id') and config.session_id:
            try:
                session_id = uuid.UUID(config.session_id)
                session = get_session(db, session_id)
                
                if session:
                    # Create a session configuration for this test
                    session_config = create_session_config(
                        db,
                        session_id=session_id,
                        endpoint_url=str(config.target_url),
                        http_method="MULTIPLE",  # This test can use multiple methods
                        concurrent_users=config.concurrent_users,
                        ramp_up_time=0,  # Not applicable for this test type
                        test_duration=config.duration,
                        think_time=0,  # Not applicable for this test type
                        request_headers=config.headers,
                        request_params=None,  # Not applicable for this test type
                        success_criteria=None  # Not applicable for this test type
                    )
            except (ValueError, Exception) as e:
                logger.warning(f"Could not store test configuration: {str(e)}")
        
        # Start the test
        await stress_tester.start_test(
            test_id=test_id,
            target_url=config.target_url,
            concurrent_users=config.concurrent_users,
            request_rate=config.request_rate,
            duration=config.duration,
            endpoints=config.endpoints,
            headers=config.headers,
            payload_data=config.payload_data
        )
        
        # Store initial test result in the database if we have a session configuration
        if session_config:
            create_test_result(
                db,
                configuration_id=session_config.id,
                test_id=test_id,
                status=TestStatus.RUNNING.value,
                start_time=datetime.now()
            )
        
        # Store test configuration for later reference
        test_progress[test_id] = {
            "status": TestStatus.RUNNING,
            "config": config,
            "start_time": datetime.now(),
            "session_config_id": str(session_config.id) if session_config else None
        }
        
        return TestStartResponse(
            test_id=test_id,
            status=TestStatus.RUNNING,
            config=config,
            start_time=datetime.now()
        )
    except Exception as e:
        logger.error(f"Error starting test: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error starting test: {str(e)}"
        )

# Endpoint to get test results
@app.get("/api/test/{test_id}/results", response_model=TestResultsResponse)
async def get_test_results(test_id: str, db: Session = Depends(get_db)):
    try:
        if test_id not in stress_tester.results:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Test with ID {test_id} not found"
            )
        
        results = stress_tester.results[test_id]
        test_status = test_progress.get(test_id, {}).get("status", TestStatus.PENDING)
        
        # Get summary statistics
        summary = get_test_summary(test_id)
        
        # Update test result in the database if we have a session configuration
        session_config_id = test_progress.get(test_id, {}).get("session_config_id")
        if session_config_id:
            try:
                config_id = uuid.UUID(session_config_id)
                test_result = get_test_result_by_test_id(db, test_id)
                
                if test_result:
                    # Update the test result with the latest data
                    update_test_result(
                        db,
                        result_id=test_result.id,
                        status=test_status.value,
                        total_requests=summary.get("total_requests", 0),
                        successful_requests=summary.get("successful_requests", 0),
                        failed_requests=summary.get("failed_requests", 0),
                        avg_response_time=summary.get("avg_response_time"),
                        min_response_time=summary.get("min_response_time"),
                        max_response_time=summary.get("max_response_time"),
                        status_codes=summary.get("status_codes"),
                        summary=summary,
                        results_data=results,
                        end_time=datetime.now() if test_status in [TestStatus.COMPLETED, TestStatus.FAILED, TestStatus.STOPPED] else None
                    )
            except Exception as e:
                logger.warning(f"Could not update test result in database: {str(e)}")
        
        return TestResultsResponse(
            test_id=test_id,
            status=test_status,
            results=results,
            summary=summary
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting test results: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error getting test results: {str(e)}"
        )

# Endpoint to stop ongoing test
@app.post("/api/test/{test_id}/stop", response_model=TestStopResponse)
async def stop_test(test_id: str, db: Session = Depends(get_db)):
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
                config_id = uuid.UUID(session_config_id)
                test_result = get_test_result_by_test_id(db, test_id)
                
                if test_result:
                    # Update the test result with the latest data
                    summary = get_test_summary(test_id)
                    update_test_result(
                        db,
                        result_id=test_result.id,
                        status=TestStatus.STOPPED.value,
                        total_requests=summary.get("total_requests", 0),
                        successful_requests=summary.get("successful_requests", 0),
                        failed_requests=summary.get("failed_requests", 0),
                        avg_response_time=summary.get("avg_response_time"),
                        min_response_time=summary.get("min_response_time"),
                        max_response_time=summary.get("max_response_time"),
                        status_codes=summary.get("status_codes"),
                        summary=summary,
                        results_data=stress_tester.results.get(test_id, {}),
                        end_time=datetime.now()
                    )
            except Exception as e:
                logger.warning(f"Could not update test result in database: {str(e)}")
        
        return TestStopResponse(
            test_id=test_id,
            status=TestStatus.STOPPED,
            stop_time=datetime.now()
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping test: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error stopping test: {str(e)}"
        )

# Endpoint to start an advanced stress test with multiple strategies
@app.post("/api/stress-test/start", response_model=TestStartResponse)
async def start_advanced_test(config: StressTestConfig, db: Session = Depends(get_db)):
    try:
        test_id = str(uuid.uuid4())
        
        # Store test configuration in the database if a session_id is provided
        session_config = None
        if hasattr(config, 'session_id') and config.session_id:
            try:
                session_id = uuid.UUID(config.session_id)
                session = get_session(db, session_id)
                
                if session:
                    # Create a session configuration for this test
                    session_config = create_session_config(
                        db,
                        session_id=session_id,
                        endpoint_url=str(config.target_url),
                        http_method="MULTIPLE",  # This test can use multiple methods
                        concurrent_users=config.max_concurrent_users,
                        ramp_up_time=0,  # Not applicable for this test type
                        test_duration=config.duration,
                        think_time=0,  # Not applicable for this test type
                        request_headers=config.headers,
                        request_params=None,  # Not applicable for this test type
                        success_criteria=None  # Not applicable for this test type
                    )
            except (ValueError, Exception) as e:
                logger.warning(f"Could not store test configuration: {str(e)}")
        
        # Start the test based on the strategy
        if config.strategy == DistributionStrategy.SEQUENTIAL:
            await stress_tester.start_sequential_test(
                test_id=test_id,
                target_url=config.target_url,
                endpoints=[{
                    "path": endpoint.path,
                    "method": endpoint.method,
                    "custom_parameters": endpoint.custom_parameters
                } for endpoint in config.endpoints],
                max_concurrent_users=config.max_concurrent_users,
                request_rate=config.request_rate,
                duration=config.duration,
                headers=config.headers
            )
        elif config.strategy == DistributionStrategy.INTERLEAVED:
            await stress_tester.start_interleaved_test(
                test_id=test_id,
                target_url=config.target_url,
                endpoints=[{
                    "path": endpoint.path,
                    "method": endpoint.method,
                    "weight": endpoint.weight,
                    "custom_parameters": endpoint.custom_parameters
                } for endpoint in config.endpoints],
                max_concurrent_users=config.max_concurrent_users,
                request_rate=config.request_rate,
                duration=config.duration,
                headers=config.headers
            )
        elif config.strategy == DistributionStrategy.RANDOM:
            await stress_tester.start_random_test(
                test_id=test_id,
                target_url=config.target_url,
                endpoints=[{
                    "path": endpoint.path,
                    "method": endpoint.method,
                    "weight": endpoint.weight,
                    "custom_parameters": endpoint.custom_parameters
                } for endpoint in config.endpoints],
                max_concurrent_users=config.max_concurrent_users,
                request_rate=config.request_rate,
                duration=config.duration,
                headers=config.headers
            )
        else:
            raise ValueError(f"Unsupported distribution strategy: {config.strategy}")
        
        # Store initial test result in the database if we have a session configuration
        if session_config:
            create_test_result(
                db,
                configuration_id=session_config.id,
                test_id=test_id,
                status=TestStatus.RUNNING.value,
                start_time=datetime.now()
            )
        
        # Store test configuration for later reference
        test_progress[test_id] = {
            "status": TestStatus.RUNNING,
            "config": config,
            "start_time": datetime.now(),
            "session_config_id": str(session_config.id) if session_config else None
        }
        
        return TestStartResponse(
            test_id=test_id,
            status=TestStatus.RUNNING,
            config=config,
            start_time=datetime.now()
        )
    except Exception as e:
        logger.error(f"Error starting advanced test: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error starting advanced test: {str(e)}"
        )

# Endpoint to get advanced test results
@app.get("/api/stress-test/{test_id}/results", response_model=StressTestResultsResponse)
async def get_advanced_test_results(test_id: str, db: Session = Depends(get_db)):
    try:
        if test_id not in stress_tester.results:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Test with ID {test_id} not found"
            )
        
        results = []
        raw_results = stress_tester.results.get(test_id, {})
        
        # Process results for each endpoint
        for endpoint_key, endpoint_results in raw_results.items():
            for result in endpoint_results:
                results.append(EndpointResult(
                    endpoint=endpoint_key,
                    concurrent_requests=result.get("concurrent_requests", 0),
                    success_count=result.get("success_count", 0),
                    failure_count=result.get("failure_count", 0),
                    avg_response_time=result.get("avg_response_time", 0),
                    min_response_time=result.get("min_response_time", 0),
                    max_response_time=result.get("max_response_time", 0),
                    status_codes=result.get("status_codes", {}),
                    timestamp=datetime.now(),
                    error_message=result.get("error_message")
                ))
        
        # Get test status and configuration
        test_status = test_progress.get(test_id, {}).get("status", TestStatus.PENDING)
        test_config = test_progress.get(test_id, {}).get("config")
        test_start_time = test_progress.get(test_id, {}).get("start_time", datetime.now())
        
        # Calculate summary statistics
        summary = {
            "total_requests": sum(r.success_count + r.failure_count for r in results),
            "successful_requests": sum(r.success_count for r in results),
            "failed_requests": sum(r.failure_count for r in results),
            "avg_response_time": sum(r.avg_response_time * (r.success_count + r.failure_count) 
                                    for r in results) / max(1, sum(r.success_count + r.failure_count for r in results)),
            "min_response_time": min((r.min_response_time for r in results), default=0),
            "max_response_time": max((r.max_response_time for r in results), default=0),
            "status_codes": {}
        }
        
        # Combine status codes from all results
        for result in results:
            for status_code, count in result.status_codes.items():
                if status_code in summary["status_codes"]:
                    summary["status_codes"][status_code] += count
                else:
                    summary["status_codes"][status_code] = count
        
        # Update test result in the database if we have a session configuration
        session_config_id = test_progress.get(test_id, {}).get("session_config_id")
        if session_config_id:
            try:
                config_id = uuid.UUID(session_config_id)
                test_result = get_test_result_by_test_id(db, test_id)
                
                if test_result:
                    # Update the test result with the latest data
                    update_test_result(
                        db,
                        result_id=test_result.id,
                        status=test_status.value,
                        total_requests=summary.get("total_requests", 0),
                        successful_requests=summary.get("successful_requests", 0),
                        failed_requests=summary.get("failed_requests", 0),
                        avg_response_time=summary.get("avg_response_time"),
                        min_response_time=summary.get("min_response_time"),
                        max_response_time=summary.get("max_response_time"),
                        status_codes=summary.get("status_codes"),
                        summary=summary,
                        results_data=raw_results,
                        end_time=datetime.now() if test_status in [TestStatus.COMPLETED, TestStatus.FAILED, TestStatus.STOPPED] else None
                    )
            except Exception as e:
                logger.warning(f"Could not update test result in database: {str(e)}")
        
        return StressTestResultsResponse(
            test_id=test_id,
            status=test_status,
            config=test_config,
            start_time=test_start_time,
            end_time=datetime.now() if test_status in [TestStatus.COMPLETED, TestStatus.FAILED, TestStatus.STOPPED] else None,
            results=results,
            summary=summary
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting advanced test results: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error getting advanced test results: {str(e)}"
        )

# Endpoint to stop an advanced test
@app.post("/api/stress-test/{test_id}/stop", response_model=TestStopResponse)
async def stop_advanced_test(test_id: str, db: Session = Depends(get_db)):
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
                config_id = uuid.UUID(session_config_id)
                test_result = get_test_result_by_test_id(db, test_id)
                
                if test_result:
                    # Get the latest results and update the database
                    results_response = await get_advanced_test_results(test_id, db)
                    summary = results_response.summary
                    
                    update_test_result(
                        db,
                        result_id=test_result.id,
                        status=TestStatus.STOPPED.value,
                        total_requests=summary.get("total_requests", 0),
                        successful_requests=summary.get("successful_requests", 0),
                        failed_requests=summary.get("failed_requests", 0),
                        avg_response_time=summary.get("avg_response_time"),
                        min_response_time=summary.get("min_response_time"),
                        max_response_time=summary.get("max_response_time"),
                        status_codes=summary.get("status_codes"),
                        summary=summary,
                        results_data=stress_tester.results.get(test_id, {}),
                        end_time=datetime.now()
                    )
            except Exception as e:
                logger.warning(f"Could not update test result in database: {str(e)}")
        
        return TestStopResponse(
            test_id=test_id,
            status=TestStatus.STOPPED,
            stop_time=datetime.now()
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping advanced test: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error stopping advanced test: {str(e)}"
        )

# New endpoint to get filtered test results
@app.get("/api/test-results/filter", response_model=TestResultsResponse)
async def get_filtered_test_results(
    user_email: str,
    session_id: Optional[str] = None,
    configuration_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    try:
        # Get filtered test results
        results = get_filtered_user_test_results(
            db,
            user_email=user_email,
            session_id=session_id,
            configuration_id=configuration_id,
            status=status,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            offset=offset
        )
        
        # Get total count for pagination
        total_count = get_filtered_user_test_results_count(
            db,
            user_email=user_email,
            session_id=session_id,
            configuration_id=configuration_id,
            status=status,
            start_date=start_date,
            end_date=end_date
        )
        
        # Convert database results to API response model
        test_results = []
        for result in results:
            test_result = TestResultModel(
                id=str(result.id),
                configuration_id=str(result.configuration_id),
                test_id=result.test_id,
                start_time=result.start_time,
                end_time=result.end_time,
                status=result.status,
                total_requests=result.total_requests,
                successful_requests=result.successful_requests,
                failed_requests=result.failed_requests,
                avg_response_time=result.avg_response_time,
                min_response_time=result.min_response_time,
                max_response_time=result.max_response_time,
                status_codes=result.status_codes,
                results_data=result.results_data,
                summary=result.summary
            )
            test_results.append(test_result)
        
        return TestResultsResponse(
            results=test_results,
            total=total_count,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        logger.error(f"Error getting filtered test results: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error getting filtered test results: {str(e)}"
        )

# New endpoint to get test result by ID
@app.get("/api/test-results/{result_id}", response_model=TestResultModel)
async def get_test_result_by_id(result_id: str, db: Session = Depends(get_db)):
    try:
        # Convert string ID to UUID
        try:
            result_uuid = uuid.UUID(result_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid result ID format: {result_id}"
            )
        
        # Get test result from database
        result = get_test_result(db, result_uuid)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Test result with ID {result_id} not found"
            )
        
        # Convert database result to API response model
        return TestResultModel(
            id=str(result.id),
            configuration_id=str(result.configuration_id),
            test_id=result.test_id,
            start_time=result.start_time,
            end_time=result.end_time,
            status=result.status,
            total_requests=result.total_requests,
            successful_requests=result.successful_requests,
            failed_requests=result.failed_requests,
            avg_response_time=result.avg_response_time,
            min_response_time=result.min_response_time,
            max_response_time=result.max_response_time,
            status_codes=result.status_codes,
            results_data=result.results_data,
            summary=result.summary
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting test result: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error getting test result: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
