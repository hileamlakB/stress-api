from pydantic import BaseModel, Field, HttpUrl
from typing import List, Dict, Any, Optional
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
