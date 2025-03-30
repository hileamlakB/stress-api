from pydantic import BaseModel, Field, HttpUrl
from typing import List, Dict, Any, Optional, Union, Literal
from datetime import datetime
from enum import Enum

class TestStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    STOPPED = "stopped"

class TargetValidationRequest(BaseModel):
    target_url: HttpUrl = Field(..., description="URL of the target API to validate")

class TargetValidationResponse(BaseModel):
    status: str = Field(..., description="Validation status (valid/invalid)")
    message: str = Field(..., description="Validation message or error details")
    openapi_available: bool = Field(default=False, description="Whether OpenAPI schema is available")

class TestConfigRequest(BaseModel):
    target_url: HttpUrl = Field(..., description="URL of the target API to test")
    concurrent_users: int = Field(..., ge=1, le=1000, description="Number of concurrent users")
    request_rate: int = Field(..., ge=1, description="Number of requests per second")
    duration: int = Field(..., ge=1, description="Test duration in seconds")
    endpoints: List[str] = Field(..., min_items=1, description="List of endpoints to test")
    headers: Optional[Dict[str, str]] = Field(default=None, description="Optional request headers")
    payload_data: Optional[Dict[str, Any]] = Field(default=None, description="Optional request payload")

class TestResponse(BaseModel):
    timestamp: datetime = Field(..., description="Timestamp of the response")
    endpoint: str = Field(..., description="Tested endpoint")
    response_time: float = Field(..., description="Response time in seconds")
    status_code: int = Field(..., description="HTTP status code")
    success: bool = Field(..., description="Whether the request was successful")
    error_message: Optional[str] = Field(default=None, description="Error message if request failed")

class TestStartResponse(BaseModel):
    test_id: str = Field(..., description="Unique identifier for the test")
    status: TestStatus = Field(..., description="Current test status")
    config: TestConfigRequest = Field(..., description="Test configuration")
    start_time: datetime = Field(..., description="Test start timestamp")

class TestResultsResponse(BaseModel):
    test_id: str = Field(..., description="Test identifier")
    status: TestStatus = Field(..., description="Current test status")
    results: List[TestResponse] = Field(default_list=[], description="List of test results")
    summary: Dict[str, Any] = Field(..., description="Test summary statistics")

class TestStopResponse(BaseModel):
    test_id: str = Field(..., description="Test identifier")
    status: TestStatus = Field(..., description="Current test status")
    stop_time: datetime = Field(..., description="Test stop timestamp")

class HealthResponse(BaseModel):
    status: str = Field(..., description="Service health status")
    timestamp: datetime = Field(..., description="Current timestamp")
    version: str = Field(..., description="API version")

class ParameterSchema(BaseModel):
    name: str = Field(..., description="Parameter name")
    location: str = Field(..., description="Parameter location (path, query, header, cookie)")
    required: bool = Field(..., description="Whether the parameter is required")
    param_schema: Dict[str, Any] = Field(..., description="Parameter schema")
    description: Optional[str] = Field(None, description="Parameter description")

class ResponseSchema(BaseModel):
    status_code: str = Field(..., description="HTTP status code")
    content_type: str = Field(..., description="Response content type")
    response_schema: Dict[str, Any] = Field(..., description="Response schema")
    description: Optional[str] = Field(None, description="Response description")

class EndpointSchema(BaseModel):
    path: str = Field(..., description="Endpoint path")
    method: str = Field(..., description="HTTP method")
    summary: str = Field(..., description="Endpoint summary")
    parameters: List[ParameterSchema] = Field(default_factory=list, description="Endpoint parameters")
    request_body: Optional[Dict[str, Any]] = Field(None, description="Request body schema")
    responses: Dict[str, ResponseSchema] = Field(default_factory=dict, description="Response schemas")
    description: Optional[str] = Field(None, description="Endpoint description")
    
    def get_parameter_description(self) -> str:
        if not self.parameters:
            return "No parameters"
        
        params = []
        for p in self.parameters:
            type_info = p.param_schema.get('type', 'any')
            if p.param_schema.get('enum'):
                type_info += f" (enum: {p.param_schema['enum']})"
            params.append(f"{p.name} ({p.location}): {type_info}{'*' if p.required else ''}")
        return "\n".join(params)
    
    def get_response_description(self) -> str:
        if not self.responses:
            return "No response schema"
        
        responses = []
        for status, response in self.responses.items():
            responses.append(f"{status}: {response.description or 'No description'}")
        return "\n".join(responses)

class OpenAPIEndpointsRequest(BaseModel):
    target_url: HttpUrl = Field(..., description="URL of the target API to analyze")

class OpenAPIEndpointsResponse(BaseModel):
    target_url: HttpUrl = Field(..., description="Target API URL")
    endpoints: List[EndpointSchema] = Field(default_factory=list, description="List of endpoints")
    timestamp: datetime = Field(default_factory=datetime.now, description="Timestamp of the analysis")

class DistributionStrategy(str, Enum):
    SEQUENTIAL = "sequential"
    INTERLEAVED = "interleaved"
    RANDOM = "random"

class StressTestEndpointConfig(BaseModel):
    path: str = Field(..., description="Endpoint path")
    method: str = Field(..., description="HTTP method")
    weight: Optional[float] = Field(1.0, description="Weight for distribution strategies")
    custom_parameters: Optional[Dict[str, Any]] = Field(None, description="Custom parameters for this endpoint")

class StressTestConfig(BaseModel):
    target_url: HttpUrl = Field(..., description="URL of the target API to test")
    strategy: DistributionStrategy = Field(DistributionStrategy.SEQUENTIAL, description="Distribution strategy")
    max_concurrent_users: int = Field(..., ge=1, le=1000, description="Maximum number of concurrent users")
    request_rate: int = Field(..., ge=1, description="Number of requests per second")
    duration: int = Field(..., ge=1, description="Test duration in seconds")
    endpoints: List[StressTestEndpointConfig] = Field(..., min_items=1, description="List of endpoints to test")
    headers: Optional[Dict[str, str]] = Field(None, description="Optional request headers")
    use_random_session: bool = Field(False, description="Whether to use random sessions for testing")

class StressTestProgressResponse(BaseModel):
    test_id: str = Field(..., description="Unique identifier for the test")
    status: TestStatus = Field(..., description="Current test status")
    elapsed_time: float = Field(..., description="Elapsed time in seconds")
    completed_requests: int = Field(..., description="Number of completed requests")
    results_available: bool = Field(..., description="Whether partial results are available")

class EndpointResult(BaseModel):
    endpoint: str = Field(..., description="Endpoint path and method")
    concurrent_requests: int = Field(..., description="Number of concurrent requests")
    success_count: int = Field(..., description="Number of successful requests")
    failure_count: int = Field(..., description="Number of failed requests")
    avg_response_time: float = Field(..., description="Average response time in seconds")
    min_response_time: float = Field(..., description="Minimum response time in seconds")
    max_response_time: float = Field(..., description="Maximum response time in seconds")
    status_codes: Dict[str, int] = Field(default_factory=dict, description="Count of each status code")
    timestamp: datetime = Field(default_factory=datetime.now, description="Timestamp of the test")
    error_message: Optional[str] = Field(None, description="Error message if any")

class StressTestResultsResponse(BaseModel):
    test_id: str = Field(..., description="Test identifier")
    status: TestStatus = Field(..., description="Current test status")
    config: StressTestConfig = Field(..., description="Test configuration")
    start_time: datetime = Field(..., description="Test start timestamp")
    end_time: Optional[datetime] = Field(None, description="Test end timestamp")
    results: List[EndpointResult] = Field(default_factory=list, description="List of endpoint results")
    summary: Dict[str, Any] = Field(..., description="Test summary statistics")

class RequirementField(BaseModel):
    type: Literal["number", "boolean", "string", "select"] = Field(..., description="Type of the requirement field")
    label: str = Field(..., description="Human-readable label for the field")
    description: str = Field(..., description="Description of what this field does")
    default_value: Any = Field(..., description="Default value for the field")
    required: bool = Field(True, description="Whether this field is required")
    options: Optional[List[str]] = Field(None, description="Options for select type")
    min: Optional[float] = Field(None, description="Minimum value for number type")
    max: Optional[float] = Field(None, description="Maximum value for number type")

class EndpointRequirement(BaseModel):
    type: Literal["percentage", "rate", "weight"] = Field(..., description="Type of endpoint-specific requirement")
    description: str = Field(..., description="Description of the endpoint requirement")
    must_total: Optional[int] = Field(None, description="Total value that all endpoints must sum to, if applicable")
    default_distribution: Literal["even", "weighted", "custom"] = Field("even", description="Default distribution method")

class StrategyRequirements(BaseModel):
    name: str = Field(..., description="Display name of the strategy")
    description: str = Field(..., description="Description of what the strategy does")
    general_requirements: Dict[str, RequirementField] = Field(default_factory=dict, description="General requirements for the strategy")
    endpoint_specific_requirements: bool = Field(False, description="Whether this strategy needs per-endpoint configuration")
    endpoint_requirements: Optional[EndpointRequirement] = Field(None, description="Requirements for each endpoint, if needed")

class DistributionRequirementsResponse(BaseModel):
    strategies: Dict[str, StrategyRequirements] = Field(..., description="Requirements for each distribution strategy")
