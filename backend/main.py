from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends, status, Header
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
import sys
import os
from pathlib import Path
import re

# Add parent directory to path so 'backend' is recognized
sys.path.insert(0, str(Path(__file__).parent.parent))

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
    TestResultModel,
    TestResultsFilterRequest,
    TestResultsResponse,
    SessionStatusResponse,
    SessionInfo
)
from metrics_generator import metrics_manager
from backend.database.database import get_db
from backend.database.crud import (
    get_user_by_email, 
    get_user_sessions as get_db_user_sessions, 
    get_session_configs, 
    create_session, 
    create_session_config,
    update_session_config,
    get_session,
    create_test_result,
    get_test_result,
    get_test_result_by_test_id,
    get_config_test_results,
    get_session_test_results,
    get_user_test_results,
    get_filtered_user_test_results,
    get_filtered_user_test_results_count,
    update_test_result,
    update_session,
    delete_session,
    create_user
)
from backend.database.models import User
from sqlalchemy.orm import Session

# Import our new services
# from services.user_sync_service import user_sync_service
# from services.auth_middleware import add_auth_middleware
from backend.config.settings import CORS_ORIGINS  # Keep this, but remove USER_SYNC_INTERVAL_HOURS

# Add this new import and dependency function
from backend.services.supabase_service import supabase_service

async def verify_email_confirmed(authorization: str = Header(None)):
    """Dependency to check if a user's email is verified"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )
    
    try:
        # Extract the token from the header
        token = authorization.replace("Bearer ", "")
        
        # Get the user via Supabase service
        user_id = None
        
        # Check the token with Supabase
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{supabase_service.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": supabase_service.service_key
                }
            )
            
            if response.status_code == 200:
                user_data = response.json()
                user_id = user_data.get("id")
                email_confirmed_at = user_data.get("email_confirmed_at")
                
                # If email is not confirmed, reject access
                if not email_confirmed_at:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Email not verified. Please check your email for a verification link."
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token"
                )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying user email confirmation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

async def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    """Dependency to get the current authenticated user"""
    if not authorization:
        return None
    
    try:
        # Extract the token from the header
        token = authorization.replace("Bearer ", "")
        
        # Get the user via Supabase service
        # Check the token with Supabase
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{supabase_service.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": supabase_service.service_key
                }
            )
            
            if response.status_code == 200:
                user_data = response.json()
                user_id = user_data.get("id")
                email = user_data.get("email")
                
                if not user_id or not email:
                    return None
                
                # Get or create user in our database
                user = get_user_by_email(db, email)
                if not user:
                    # Create user in our system if they don't exist yet
                    user = create_user(db, email=email, user_id=user_id)
                
                return user
            else:
                return None
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current user: {str(e)}")
        return None

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

# Request model for creating a session
class CreateSessionRequest(BaseModel):
    user_id: str
    name: str
    description: Optional[str] = None
    recurrence: Optional[Dict[str, Any]] = None

# Request model for creating a session directly with email
class CreateDirectSessionRequest(BaseModel):
    email: str
    name: str
    description: Optional[str] = None
    recurrence: Optional[Dict[str, Any]] = None

# Add this after the other session-related endpoints

class UpdateSessionConfigRequest(BaseModel):
    endpoint_url: str
    http_method: str
    concurrent_users: int
    ramp_up_time: int
    test_duration: int
    think_time: int
    request_headers: Optional[Dict[str, Any]] = None
    request_body: Optional[Dict[str, Any]] = None
    request_params: Optional[Dict[str, Any]] = None
    success_criteria: Optional[Dict[str, Any]] = None

app = FastAPI(
    title="FastAPI Stress Tester Backend",
    description="Backend service for the FastAPI Stress Testing tool",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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
async def start_test(config: TestConfigRequest, db: Session = Depends(get_db), _: None = Depends(verify_email_confirmed)):
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
async def get_test_results(test_id: str, db: Session = Depends(get_db), _: None = Depends(verify_email_confirmed)):
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
async def stop_test(test_id: str, db: Session = Depends(get_db), _: None = Depends(verify_email_confirmed)):
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
@app.post("/api/advanced-test", response_model=TestStartResponse)
async def start_advanced_test(config: StressTestConfig, db: Session = Depends(get_db), _: None = Depends(verify_email_confirmed)):
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
        
        # TRIGGER SESSION ACQUISITION FOR AUTHENTICATION
        # If the test uses session authentication, attempt to acquire sessions first
        if hasattr(config, 'authentication') and config.authentication:
            auth_config = config.authentication
            
            # For session cookie authentication
            if auth_config.get('type') == 'session':
                login_endpoint = auth_config.get('login_endpoint')
                login_method = auth_config.get('login_method', 'POST')
                
                # For multiple accounts
                if auth_config.get('multiple_accounts', False):
                    accounts = auth_config.get('accounts', [])
                    
                    # Start session acquisition for each account
                    for account in accounts:
                        # Identify the account by a key in the credentials
                        account_id = None
                        for key in ['username', 'email', 'user']:
                            if key in account:
                                account_id = account[key]
                                break
                        
                        # Launch session acquisition (don't await, handle asynchronously)
                        asyncio.create_task(stress_tester.acquire_session(
                            test_id=test_id,
                            login_url=login_endpoint,
                            login_method=login_method,
                            credentials=account,
                            account_id=account_id
                        ))
                
                # For single account
                elif auth_config.get('login_payload'):
                    credentials = auth_config.get('login_payload')
                    
                    # Launch session acquisition (don't await, handle asynchronously)
                    asyncio.create_task(stress_tester.acquire_session(
                        test_id=test_id,
                        login_url=login_endpoint,
                        login_method=login_method,
                        credentials=credentials
                    ))
        
        # Start the actual stress test based on the distribution strategy
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
async def get_advanced_test_results(test_id: str, db: Session = Depends(get_db), _: None = Depends(verify_email_confirmed)):
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
async def stop_advanced_test(test_id: str, db: Session = Depends(get_db), _: None = Depends(verify_email_confirmed)):
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

# Endpoint to get user sessions
@app.get("/api/user/{email}/sessions", response_model=UserSessionsResponse)
async def get_user_sessions(email: str, db: Session = Depends(get_db), _: None = Depends(verify_email_confirmed)):
    try:
        # Get the user by email
        user = get_user_by_email(db, email)
        if not user:
            # Return empty sessions list if user not found
            return UserSessionsResponse(
                user_id="",
                email=email,
                sessions=[]
            )

        # Get all sessions for the user
        sessions = get_db_user_sessions(db, user.id)
        
        # Map database sessions to response model
        session_models = []
        for session in sessions:
            # Get configurations for this session
            configs = get_session_configs(db, session.id)
            config_models = [
                SessionConfigModel(
                    id=str(config.id),
                    session_id=str(config.session_id),
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
                for config in configs
            ]
            
            session_models.append(SessionModel(
                id=str(session.id),
                name=session.name,
                description=session.description,
                created_at=session.created_at,
                updated_at=session.updated_at,
                configurations=config_models
            ))
        
        return UserSessionsResponse(
            user_id=str(user.id),
            email=user.email,
            sessions=session_models
        )

    except Exception as e:
        logger.error(f"Error getting user sessions: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting user sessions: {str(e)}"
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
    db: Session = Depends(get_db),
    _: None = Depends(verify_email_confirmed)
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

# Endpoint to create a session directly with email
@app.post("/api/sessions/direct", response_model=SessionModel)
async def create_direct_session_endpoint(
    request: CreateDirectSessionRequest, 
    db: Session = Depends(get_db),
    _: None = Depends(verify_email_confirmed)
):
    """Create a session directly with user email, checking Supabase auth"""
    try:
        # Check if user exists in our database
        user = get_user_by_email(db, request.email)
        
        if not user:
            # Create the user in our database
            user = create_user(db, request.email)
            logger.info(f"Created user with email {request.email} in database")
        
        # Create the session
        session = create_session(db, user.id, request.name, request.description)
        
        # Store recurrence data as part of success_criteria if provided
        if request.recurrence:
            # Create an empty configuration to store recurrence data
            config = create_session_config(
                db, 
                session.id, 
                endpoint_url="placeholder", 
                http_method="GET",
                concurrent_users=1,
                ramp_up_time=0,
                test_duration=0,
                think_time=0,
                success_criteria={"recurrence": request.recurrence}
            )
        
        # Get the created session with configurations
        configs = get_session_configs(db, session.id)
        config_models = [
            SessionConfigModel(
                id=str(config.id),
                session_id=str(config.session_id),
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
            for config in configs
        ]
        
        # Return the session model
        return SessionModel(
            id=str(session.id),
            name=session.name,
            description=session.description,
            created_at=session.created_at,
            updated_at=session.updated_at,
            configurations=config_models
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating direct session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating session: {str(e)}"
        )

# Endpoint to fetch parameters for a login endpoint
@app.post("/api/analyze-login-endpoint")
async def analyze_login_endpoint(request: dict):
    """
    Analyze a login endpoint to determine required and optional parameters.
    
    This endpoint attempts to examine a login API to determine what parameters
    it expects for authentication. It uses different strategies:
    1. Try to fetch OpenAPI docs if available
    2. Perform a preflight OPTIONS request to detect parameters
    3. Make a minimal request to analyze error responses for parameter hints
    """
    try:
        login_url = request.get("login_url")
        http_method = request.get("method", "POST")
        
        if not login_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Login URL is required"
            )
        
        parameters = {
            "required": [],
            "optional": []
        }
        
        # Try to get OpenAPI docs first - this is the most reliable method
        try:
            # Determine potential OpenAPI documentation URLs
            api_base = "/".join(login_url.split("/")[:-1])  # Remove last part of URL
            possible_docs_urls = [
                f"{api_base}/openapi.json",
                f"{api_base}/swagger/v1/swagger.json",
                f"{api_base}/api-docs",
                f"{api_base}/docs/openapi.json"
            ]
            
            openapi_data = None
            for doc_url in possible_docs_urls:
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.get(doc_url, timeout=3.0)
                        if response.status_code == 200:
                            openapi_data = response.json()
                            break
                except Exception:
                    continue
            
            if openapi_data:
                # Extract login endpoint data from OpenAPI spec
                login_path = "/" + login_url.split("/", 3)[-1] if login_url.startswith("http") else login_url
                
                # Look for the login path
                for path, methods in openapi_data.get("paths", {}).items():
                    # Check if this path matches or contains the login path (handles path params)
                    if path == login_path or (
                        path.replace("{", "").replace("}", "") == login_path.replace("{", "").replace("}", "")
                    ):
                        method_info = methods.get(http_method.lower())
                        if method_info:
                            # Extract parameters from request body
                            if "requestBody" in method_info:
                                schema = method_info["requestBody"].get("content", {}).get("application/json", {}).get("schema", {})
                                if "properties" in schema:
                                    for prop_name, prop_data in schema["properties"].items():
                                        parameter = {
                                            "name": prop_name,
                                            "type": prop_data.get("type", "string"),
                                            "description": prop_data.get("description", ""),
                                            "example": prop_data.get("example", "")
                                        }
                                        if "required" in schema and prop_name in schema["required"]:
                                            parameters["required"].append(parameter)
                                        else:
                                            parameters["optional"].append(parameter)
                            
                            # Extract URL parameters
                            for param in method_info.get("parameters", []):
                                parameter = {
                                    "name": param.get("name", ""),
                                    "type": param.get("schema", {}).get("type", "string"),
                                    "description": param.get("description", ""),
                                    "in": param.get("in", "query")
                                }
                                if param.get("required", False):
                                    parameters["required"].append(parameter)
                                else:
                                    parameters["optional"].append(parameter)
        except Exception as e:
            logger.warning(f"Error extracting OpenAPI information: {str(e)}")
        
        # If no parameters found via OpenAPI, try OPTIONS request
        if not parameters["required"] and not parameters["optional"]:
            try:
                async with httpx.AsyncClient() as client:
                    # Send OPTIONS request to get metadata
                    options_response = await client.options(
                        login_url,
                        timeout=3.0,
                        headers={"Accept": "application/json"}
                    )
                    
                    # Check for CORS headers that might indicate accepted fields
                    if "Access-Control-Allow-Headers" in options_response.headers:
                        allowed_headers = options_response.headers["Access-Control-Allow-Headers"].split(",")
                        for header in allowed_headers:
                            header = header.strip().lower()
                            if header not in ["content-type", "authorization", "accept"]:
                                parameters["optional"].append({
                                    "name": header,
                                    "type": "string",
                                    "description": "Header parameter",
                                    "in": "header"
                                })
            except Exception as e:
                logger.warning(f"Error performing OPTIONS request: {str(e)}")
        
        # Make a minimal request to analyze error responses for parameter hints
        if not parameters["required"] and not parameters["optional"]:
            try:
                async with httpx.AsyncClient() as client:
                    # Make request with empty body to see error response
                    response = await client.request(
                        http_method, 
                        login_url,
                        json={},
                        timeout=3.0,
                        headers={"Accept": "application/json"}
                    )
                    
                    # Check error response for field validation errors
                    if response.status_code in [400, 422] and response.headers.get("content-type", "").startswith("application/json"):
                        error_data = response.json()
                        
                        # FastAPI validation error format
                        if "detail" in error_data and isinstance(error_data["detail"], list):
                            for error in error_data["detail"]:
                                if "loc" in error and len(error["loc"]) > 0:
                                    field_name = error["loc"][-1]
                                    parameters["required"].append({
                                        "name": field_name,
                                        "type": "string",
                                        "description": error.get("msg", "Required field")
                                    })
                        
                        # Other common validation error formats
                        for key in ["errors", "validation_errors", "fields"]:
                            if key in error_data and isinstance(error_data[key], dict):
                                for field_name, error_msg in error_data[key].items():
                                    parameters["required"].append({
                                        "name": field_name,
                                        "type": "string",
                                        "description": error_msg if isinstance(error_msg, str) else "Required field"
                                    })
            except Exception as e:
                logger.warning(f"Error analyzing login endpoint error response: {str(e)}")
        
        # If we still couldn't determine fields, add common auth fields as suggestions
        if not parameters["required"] and not parameters["optional"]:
            common_auth_fields = [
                {"name": "username", "type": "string", "description": "Username or email"},
                {"name": "password", "type": "string", "description": "User password"},
                {"name": "email", "type": "string", "description": "Email address"},
                {"name": "token", "type": "string", "description": "Authentication token"},
                {"name": "code", "type": "string", "description": "Verification code"},
                {"name": "client_id", "type": "string", "description": "OAuth client ID"},
                {"name": "client_secret", "type": "string", "description": "OAuth client secret"}
            ]
            parameters["optional"] = common_auth_fields
        
        return {
            "login_url": login_url,
            "method": http_method,
            "parameters": parameters,
            "detection_method": "openapi" if openapi_data else "options_request" if "optional" in parameters else "error_analysis" if "required" in parameters else "suggested"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing login endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing login endpoint: {str(e)}"
        )

# Add this after the other session-related endpoints
@app.put("/api/sessions/{session_id}/configuration", response_model=SessionConfigModel)
async def update_session_configuration(
    session_id: str,
    request: UpdateSessionConfigRequest,
    db: Session = Depends(get_db),
    _: None = Depends(verify_email_confirmed)
):
    """Update or create a configuration for a session to store wizard state"""
    try:
        # Verify the session exists
        session = get_session(db, uuid.UUID(session_id))
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session with ID {session_id} not found"
            )
        
        # Get existing configuration or create a new one
        configs = get_session_configs(db, session.id)
        
        if configs and len(configs) > 0:
            # Update the first configuration
            config = update_session_config(
                db,
                configs[0].id,
                endpoint_url=request.endpoint_url,
                http_method=request.http_method,
                concurrent_users=request.concurrent_users,
                ramp_up_time=request.ramp_up_time,
                test_duration=request.test_duration,
                think_time=request.think_time,
                request_headers=request.request_headers,
                request_body=request.request_body,
                request_params=request.request_params,
                success_criteria=request.success_criteria
            )
        else:
            # Create a new configuration
            config = create_session_config(
                db,
                session.id,
                endpoint_url=request.endpoint_url,
                http_method=request.http_method,
                concurrent_users=request.concurrent_users,
                ramp_up_time=request.ramp_up_time,
                test_duration=request.test_duration,
                think_time=request.think_time,
                request_headers=request.request_headers,
                request_body=request.request_body,
                request_params=request.request_params,
                success_criteria=request.success_criteria
            )
        
        # Return the updated or created config
        return SessionConfigModel(
            id=str(config.id),
            session_id=str(config.session_id),
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating session configuration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating session configuration: {str(e)}"
        )

# Endpoint to get session acquisition status for a test
@app.get("/api/stress-test/{test_id}/session-status", response_model=SessionStatusResponse)
async def get_session_status(test_id: str, db: Session = Depends(get_db), _: None = Depends(verify_email_confirmed)):
    try:
        if test_id not in test_progress:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Test with ID {test_id} not found"
            )
        
        # Get the test progress data and config
        progress_data = test_progress.get(test_id, {})
        config = progress_data.get("config", {})
        
        # Get session acquisition status from the stress tester
        session_data = stress_tester.get_session_status(test_id)
        
        # Create the response object
        session_status = {
            "test_id": test_id,
            "status": progress_data.get("status", TestStatus.PENDING),
            "acquired_sessions": []
        }
        
        # If the stress tester has session data, use it
        if session_data and session_data.get("acquired_sessions"):
            session_status["acquired_sessions"] = session_data.get("acquired_sessions")
        
        # If authentication is configured, add auth type info
        if hasattr(config, "authentication") and config.authentication:
            auth_config = config.authentication
            
            # Add session info based on authentication type
            if auth_config.get("type") == "session":
                session_status["auth_type"] = "session"
                session_status["login_endpoint"] = auth_config.get("login_endpoint")
                
                # If we don't have data from the stress tester yet
                if not session_status["acquired_sessions"]:
                    # For multiple accounts, show status of each
                    if auth_config.get("multiple_accounts", False):
                        accounts = auth_config.get("accounts", [])
                        for i, account in enumerate(accounts):
                            # Get masked username for display (first 2 chars + ****)
                            username_key = next((k for k in account.keys() if k.lower() in ["username", "email", "user"]), None)
                            username = account.get(username_key, f"Account {i+1}") if username_key else f"Account {i+1}"
                            masked_username = username[:2] + "****" if len(username) > 2 else username
                            
                            # Add placeholder session status
                            session_status["acquired_sessions"].append({
                                "account": masked_username,
                                "status": "pending",
                                "acquired_at": None,
                                "session_id": None,
                                "error": None
                            })
                    else:
                        # Single account status
                        session_status["acquired_sessions"].append({
                            "account": "Primary Account",
                            "status": "pending",
                            "acquired_at": None,
                            "session_id": None,
                            "error": None
                        })
            
            # For token authentication
            elif auth_config.get("type") == "token":
                session_status["auth_type"] = "token"
                
                # If we don't have data from the stress tester yet
                if not session_status["acquired_sessions"]:
                    # For multiple tokens
                    if auth_config.get("multiple_tokens", False):
                        tokens = auth_config.get("tokens", [])
                        for i, _ in enumerate(tokens):
                            # Add placeholder token status
                            session_status["acquired_sessions"].append({
                                "token_id": f"Token {i+1}",
                                "status": "pending",
                                "error": None
                            })
                    else:
                        # Single token status
                        session_status["acquired_sessions"].append({
                            "token_id": "Primary Token",
                            "status": "pending",
                            "error": None
                        })
            
            # For basic auth
            elif auth_config.get("type") == "basic":
                session_status["auth_type"] = "basic"
                
                # If we don't have data from the stress tester yet
                if not session_status["acquired_sessions"]:
                    # For multiple accounts
                    if auth_config.get("multiple_accounts", False):
                        accounts = auth_config.get("accounts", [])
                        for i, account in enumerate(accounts):
                            username = account.get("username", f"User {i+1}")
                            masked_username = username[:2] + "****" if len(username) > 2 else username
                            
                            # Add placeholder basic auth status
                            session_status["acquired_sessions"].append({
                                "username": masked_username,
                                "status": "pending",
                                "error": None
                            })
                    else:
                        # Single account status
                        session_status["acquired_sessions"].append({
                            "username": "Primary User",
                            "status": "pending",
                            "error": None
                        })
        
        return SessionStatusResponse(**session_status)
        
    except Exception as e:
        logger.error(f"Error getting session status: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error getting session status: {str(e)}"
        )

# Endpoint to get progress information for an advanced test
@app.get("/api/stress-test/{test_id}/progress", response_model=StressTestProgressResponse)
async def get_advanced_test_progress(test_id: str, db: Session = Depends(get_db), _: None = Depends(verify_email_confirmed)):
    try:
        progress = stress_tester.get_test_progress(test_id)
        
        return StressTestProgressResponse(
            test_id=progress["test_id"],
            status=progress["status"],
            elapsed_time=progress["elapsed_time"],
            completed_requests=progress["completed_requests"],
            results_available=progress["results_available"]
        )
    except Exception as e:
        logger.error(f"Error getting test progress: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error getting test progress: {str(e)}"
        )

@app.post("/api/generate-fake-data", response_model=dict)
async def generate_fake_data(request: dict, current_user: Optional[User] = Depends(get_current_user)):
    """Generate fake data for a specific endpoint"""
    url = request.get("url")
    method = request.get("method")
    path = request.get("path")
    
    if not url or not method or not path:
        raise HTTPException(
            status_code=400, 
            detail="Missing required parameters: url, method, path"
        )
    
    try:
        # Parse OpenAPI from the URL
        try:
            # Use the static method like in other endpoints
            endpoints = await OpenAPIParser.get_endpoints(url)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse OpenAPI schema: {str(e)}"
            )
        
        # Find the specific endpoint - perform a more flexible match for path parameters
        endpoint = None
        exact_match = False
        
        # First try exact match
        for ep in endpoints:
            if ep.method.upper() == method.upper() and ep.path == path:
                endpoint = ep
                exact_match = True
                break
        
        # If no exact match, try pattern matching (handle path parameters)
        if not endpoint:
            for ep in endpoints:
                if ep.method.upper() == method.upper():
                    # Create regex patterns by replacing {param} with any characters
                    ep_pattern = ep.path.replace("/", "\\/")
                    ep_pattern = re.sub(r'\{[^}]+\}', '[^/]+', ep_pattern)
                    ep_pattern = f"^{ep_pattern}$"
                    
                    if re.match(ep_pattern, path):
                        endpoint = ep
                        break
        
        # If still not found, create a simulated endpoint based on the path and method
        if not endpoint:
            # Extract potential path parameters from the provided path
            param_names = re.findall(r'\{([^}]+)\}', path)
            parameters = []
            
            # Create parameter objects for the path parameters
            for param_name in param_names:
                parameters.append({
                    "name": param_name,
                    "location": "path",
                    "required": True,
                    "param_schema": {"type": "string"}
                })
            
            # Add common parameters based on the method
            if method in ["POST", "PUT", "PATCH"]:
                # For methods that typically have a request body
                request_body = {
                    "type": "object",
                    "properties": {
                        "sample": {
                            "type": "string"
                        },
                        "number": {
                            "type": "integer"
                        },
                        "boolean": {
                            "type": "boolean"
                        }
                    }
                }
            else:
                request_body = None
                
                # For GET methods, often have query parameters
                if method == "GET":
                    # Add some common query parameters
                    parameters.append({
                        "name": "limit",
                        "location": "query",
                        "required": False,
                        "param_schema": {"type": "integer"}
                    })
                    parameters.append({
                        "name": "offset",
                        "location": "query",
                        "required": False,
                        "param_schema": {"type": "integer"}
                    })
            
            # Create a simulated endpoint
            from collections import namedtuple
            MockEndpoint = namedtuple('MockEndpoint', ['method', 'path', 'parameters', 'request_body'])
            endpoint = MockEndpoint(
                method=method,
                path=path,
                parameters=parameters,
                request_body=request_body
            )
            
            logger.info(f"Created simulated endpoint for {method} {path} with {len(parameters)} parameters")
        
        # Initialize data generator
        data_generator = RequestDataGenerator()
        
        # Generate header parameters
        headers = {}
        # Add standard headers
        headers["Content-Type"] = "application/json"
        headers["Accept"] = "application/json"
        
        if hasattr(endpoint, 'parameters'):
            for param in endpoint.parameters:
                if hasattr(param, 'location') and param.location == "header":
                    param_schema = getattr(param, 'param_schema', {"type": "string"})
                    headers[param.name] = data_generator.generate_primitive(
                        param_schema.get("type", "string"),
                        param_schema.get("format"),
                        param_schema.get("enum")
                    )
        
        # Generate path parameters
        path_params = {}
        if hasattr(endpoint, 'parameters'):
            for param in endpoint.parameters:
                if hasattr(param, 'location') and param.location == "path":
                    param_schema = getattr(param, 'param_schema', {"type": "string"})
                    path_params[param.name] = data_generator.generate_primitive(
                        param_schema.get("type", "string"),
                        param_schema.get("format"),
                        param_schema.get("enum")
                    )
                    
            # Extract path parameters from the URL in case there are any not defined in the schema
            path_param_matches = re.findall(r'\{([^}]+)\}', path)
            for param_name in path_param_matches:
                if param_name not in path_params:
                    # Generate reasonable values based on parameter name
                    if "id" in param_name.lower():
                        path_params[param_name] = str(random.randint(1, 1000))
                    elif "date" in param_name.lower():
                        path_params[param_name] = datetime.now().strftime("%Y-%m-%d")
                    elif "uuid" in param_name.lower():
                        path_params[param_name] = str(uuid.uuid4())
                    else:
                        path_params[param_name] = f"sample_{param_name}"
        
        # Generate query parameters
        query_params = {}
        if hasattr(endpoint, 'parameters'):
            for param in endpoint.parameters:
                if hasattr(param, 'location') and param.location == "query":
                    param_schema = getattr(param, 'param_schema', {"type": "string"})
                    query_params[param.name] = data_generator.generate_primitive(
                        param_schema.get("type", "string"),
                        param_schema.get("format"),
                        param_schema.get("enum")
                    )
        
        # Generate request body if it exists
        request_body = {}
        if hasattr(endpoint, 'request_body') and endpoint.request_body:
            try:
                request_body = data_generator.generate_request_data(endpoint.request_body)
            except Exception as e:
                logger.warning(f"Error generating request body: {str(e)}")
                # Provide a generic request body if generation fails
                request_body = {
                    "sample": "data",
                    "number": 123,
                    "boolean": True
                }
        elif method in ["POST", "PUT", "PATCH"]:
            # For methods that typically have request bodies, provide a generic one
            resource_name = None
            path_parts = path.split('/')
            for part in reversed(path_parts):
                if not (part.startswith('{') and part.endswith('}')):
                    resource_name = part
                    break
                    
            if resource_name:
                if resource_name.endswith('s'):
                    resource_name = resource_name[:-1]  # Convert plural to singular
                    
                # Generate appropriate request body based on resource name
                if "user" in resource_name.lower():
                    request_body = {
                        "name": "John Doe",
                        "email": "user@example.com",
                        "username": "johndoe123"
                    }
                elif "product" in resource_name.lower():
                    request_body = {
                        "name": "Sample Product",
                        "price": 99.99,
                        "description": "This is a sample product description"
                    }
                elif "order" in resource_name.lower():
                    request_body = {
                        "order_id": "ORD-123",
                        "customer_id": "CUST-456",
                        "items": [
                            {
                                "product_id": "PROD-789",
                                "quantity": 2,
                                "price": 49.99
                            }
                        ]
                    }
                else:
                    request_body = {
                        "name": f"Sample {resource_name}",
                        "description": f"This is a sample {resource_name}",
                        "created_at": datetime.now().isoformat()
                    }
            else:
                # Generic request body
                request_body = {
                    "sample": "data",
                    "number": 123,
                    "boolean": True
                }
        
        # Return the generated data
        result = {
            "endpoint": f"{method} {path}",
            "samples": {
                "headers": headers,
                "path_params": path_params,
                "query_params": query_params,
                "request_body": request_body
            }
        }
        
        return result
        
    except Exception as e:
        logger.error(f"Error generating fake data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating fake data: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
