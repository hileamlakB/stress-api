import sys
import os
from pathlib import Path

# Add the parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import pytest
from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl, ValidationError, constr, validator
from typing import List, Dict, Any, Optional, Literal
from enum import Enum

# Define minimal test models
class TestStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    STOPPED = "stopped"

class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"

class DistributionStrategy(str, Enum):
    SEQUENTIAL = "sequential"
    INTERLEAVED = "interleaved"
    RANDOM = "random"

class DataGenerationStrategy(str, Enum):
    RANDOM_EACH_TIME = "random_each_time"
    CONSISTENT_RANDOM = "consistent_random"
    USER_DEFINED = "user_defined"

class StressTestEndpointConfig(BaseModel):
    path: str = Field(..., description="Endpoint path")
    method: constr(min_length=1) = Field(..., description="HTTP method")
    weight: Optional[float] = Field(1.0, description="Weight for distribution strategies")
    custom_parameters: Optional[Dict[str, Any]] = Field(None, description="Custom parameters for this endpoint")
    data_strategy: DataGenerationStrategy = Field(
        DataGenerationStrategy.CONSISTENT_RANDOM,
        description="Strategy for generating test data"
    )
    test_data_samples: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Sample data to use for testing"
    )

class StressTestConfig(BaseModel):
    target_url: HttpUrl = Field(..., description="URL of the target API to test")
    strategy: DistributionStrategy = Field(DistributionStrategy.SEQUENTIAL, description="Distribution strategy")
    max_concurrent_users: int = Field(..., ge=1, le=1000, description="Maximum number of concurrent users")
    request_rate: int = Field(..., ge=1, description="Number of requests per second")
    duration: int = Field(..., ge=1, description="Test duration in seconds")
    endpoints: List[StressTestEndpointConfig] = Field(..., min_length=1, description="List of endpoints to test")
    headers: Optional[Dict[str, str]] = Field(None, description="Optional request headers")
    use_random_session: bool = Field(False, description="Whether to use random sessions for testing")

class RequirementField(BaseModel):
    type: Literal["number", "boolean", "string", "select"] = Field(..., description="Type of the requirement field")
    label: str = Field(..., description="Human-readable label for the field")
    description: str = Field(..., description="Description of what this field does")
    default_value: Any = Field(..., description="Default value for the field")
    required: bool = Field(True, description="Whether this field is required")
    options: Optional[List[str]] = Field(None, description="Options for select type")
    min: Optional[float] = Field(None, description="Minimum value for number type")
    max: Optional[float] = Field(None, description="Maximum value for number type")

class EndpointResult(BaseModel):
    endpoint: str = Field(..., description="Endpoint path and method")
    concurrent_requests: int = Field(..., ge=0, description="Number of concurrent requests")
    success_count: int = Field(..., ge=0, description="Number of successful requests")
    failure_count: int = Field(..., ge=0, description="Number of failed requests")
    avg_response_time: float = Field(..., ge=0, description="Average response time in seconds")
    min_response_time: float = Field(..., ge=0, description="Minimum response time in seconds")
    max_response_time: float = Field(..., ge=0, description="Maximum response time in seconds")
    status_codes: Dict[str, int] = Field(default_factory=dict, description="Count of each status code")
    error_message: Optional[str] = Field(None, description="Error message if any")

    @validator('max_response_time')
    def validate_response_times(cls, v, values):
        if 'min_response_time' in values and v < values['min_response_time']:
            raise ValueError('max_response_time must be greater than or equal to min_response_time')
        return v

class SessionInfo(BaseModel):
    account: Optional[str] = Field(None, description="Account identifier")
    username: Optional[str] = Field(None, description="Username for basic auth")
    token_id: Optional[str] = Field(None, description="Token identifier")
    status: constr(min_length=1) = Field(..., description="Status of the session")
    acquired_at: Optional[str] = Field(None, description="Timestamp when session was acquired")
    session_id: Optional[str] = Field(None, description="Session identifier")
    error: Optional[str] = Field(None, description="Error message if session acquisition failed")

# Tests for enums
def test_task_status_enum():
    """Test the TaskStatus enum values"""
    assert TaskStatus.PENDING == "pending"
    assert TaskStatus.RUNNING == "running"
    assert TaskStatus.COMPLETED == "completed"
    assert TaskStatus.FAILED == "failed"
    assert TaskStatus.CANCELED == "canceled"

def test_test_status_enum():
    """Test TestStatus enum values"""
    assert TestStatus.PENDING == "pending"
    assert TestStatus.RUNNING == "running"
    assert TestStatus.COMPLETED == "completed"
    assert TestStatus.FAILED == "failed"
    assert TestStatus.STOPPED == "stopped"

def test_distribution_strategy_enum():
    """Test DistributionStrategy enum values"""
    assert DistributionStrategy.SEQUENTIAL == "sequential"
    assert DistributionStrategy.INTERLEAVED == "interleaved"
    assert DistributionStrategy.RANDOM == "random"

def test_data_generation_strategy_enum():
    """Test DataGenerationStrategy enum values"""
    assert DataGenerationStrategy.RANDOM_EACH_TIME == "random_each_time"
    assert DataGenerationStrategy.CONSISTENT_RANDOM == "consistent_random"
    assert DataGenerationStrategy.USER_DEFINED == "user_defined"

# Tests for StressTestEndpointConfig
def test_stress_test_endpoint_config_minimal():
    """Test StressTestEndpointConfig with minimal parameters"""
    config = StressTestEndpointConfig(
        path="/api/test",
        method="GET"
    )
    assert config.path == "/api/test"
    assert config.method == "GET"
    assert config.weight == 1.0  # Default value
    assert config.custom_parameters is None
    assert config.data_strategy == DataGenerationStrategy.CONSISTENT_RANDOM
    assert config.test_data_samples is None

def test_stress_test_endpoint_config_full():
    """Test StressTestEndpointConfig with all parameters"""
    config = StressTestEndpointConfig(
        path="/api/test",
        method="POST",
        weight=2.5,
        custom_parameters={"timeout": 30},
        data_strategy=DataGenerationStrategy.USER_DEFINED,
        test_data_samples=[{"id": 1}, {"id": 2}]
    )
    assert config.path == "/api/test"
    assert config.method == "POST"
    assert config.weight == 2.5
    assert config.custom_parameters == {"timeout": 30}
    assert config.data_strategy == DataGenerationStrategy.USER_DEFINED
    assert config.test_data_samples == [{"id": 1}, {"id": 2}]

def test_stress_test_endpoint_config_invalid_method():
    """Test StressTestEndpointConfig with invalid method"""
    with pytest.raises(ValidationError):
        StressTestEndpointConfig(
            path="/api/test",
            method=""  # Empty method should fail
        )

# Tests for StressTestConfig
def test_stress_test_config_minimal():
    """Test StressTestConfig with minimal parameters"""
    config = StressTestConfig(
        target_url="https://api.example.com",
        max_concurrent_users=10,
        request_rate=5,
        duration=30,
        endpoints=[
            StressTestEndpointConfig(
                path="/test",
                method="GET"
            )
        ]
    )
    assert str(config.target_url).rstrip("/") == "https://api.example.com"
    assert config.strategy == DistributionStrategy.SEQUENTIAL  # Default value
    assert config.max_concurrent_users == 10
    assert config.request_rate == 5
    assert config.duration == 30
    assert len(config.endpoints) == 1
    assert config.headers is None
    assert config.use_random_session is False

def test_stress_test_config_full():
    """Test StressTestConfig with all parameters"""
    config = StressTestConfig(
        target_url="https://api.example.com",
        strategy=DistributionStrategy.RANDOM,
        max_concurrent_users=100,
        request_rate=50,
        duration=60,
        endpoints=[
            StressTestEndpointConfig(path="/test1", method="GET"),
            StressTestEndpointConfig(path="/test2", method="POST")
        ],
        headers={"Authorization": "Bearer token"},
        use_random_session=True
    )
    assert str(config.target_url).rstrip("/") == "https://api.example.com"
    assert config.strategy == DistributionStrategy.RANDOM
    assert config.max_concurrent_users == 100
    assert config.request_rate == 50
    assert config.duration == 60
    assert len(config.endpoints) == 2
    assert config.headers == {"Authorization": "Bearer token"}
    assert config.use_random_session is True

def test_stress_test_config_invalid_concurrent_users():
    """Test StressTestConfig with invalid concurrent users"""
    with pytest.raises(ValidationError):
        StressTestConfig(
            target_url="https://api.example.com",
            max_concurrent_users=0,  # Should be >= 1
            request_rate=5,
            duration=30,
            endpoints=[StressTestEndpointConfig(path="/test", method="GET")]
        )

def test_stress_test_config_invalid_request_rate():
    """Test StressTestConfig with invalid request rate"""
    with pytest.raises(ValidationError):
        StressTestConfig(
            target_url="https://api.example.com",
            max_concurrent_users=10,
            request_rate=0,  # Should be >= 1
            duration=30,
            endpoints=[StressTestEndpointConfig(path="/test", method="GET")]
        )

def test_stress_test_config_invalid_duration():
    """Test StressTestConfig with invalid duration"""
    with pytest.raises(ValidationError):
        StressTestConfig(
            target_url="https://api.example.com",
            max_concurrent_users=10,
            request_rate=5,
            duration=0,  # Should be >= 1
            endpoints=[StressTestEndpointConfig(path="/test", method="GET")]
        )

def test_stress_test_config_empty_endpoints():
    """Test StressTestConfig with empty endpoints list"""
    with pytest.raises(ValidationError):
        StressTestConfig(
            target_url="https://api.example.com",
            max_concurrent_users=10,
            request_rate=5,
            duration=30,
            endpoints=[]  # Should have at least one endpoint
        )

# Tests for RequirementField
def test_requirement_field_number():
    """Test RequirementField with number type"""
    field = RequirementField(
        type="number",
        label="Concurrent Users",
        description="Number of concurrent users",
        default_value=10,
        min=1,
        max=1000
    )
    assert field.type == "number"
    assert field.label == "Concurrent Users"
    assert field.description == "Number of concurrent users"
    assert field.default_value == 10
    assert field.min == 1
    assert field.max == 1000
    assert field.required is True
    assert field.options is None

def test_requirement_field_select():
    """Test RequirementField with select type"""
    field = RequirementField(
        type="select",
        label="Strategy",
        description="Distribution strategy",
        default_value="sequential",
        options=["sequential", "random", "interleaved"],
        required=False
    )
    assert field.type == "select"
    assert field.label == "Strategy"
    assert field.description == "Distribution strategy"
    assert field.default_value == "sequential"
    assert field.options == ["sequential", "random", "interleaved"]
    assert field.required is False
    assert field.min is None
    assert field.max is None

def test_requirement_field_invalid_type():
    """Test RequirementField with invalid type"""
    with pytest.raises(ValidationError):
        RequirementField(
            type="invalid",  # Invalid type
            label="Test",
            description="Test field",
            default_value="test"
        )

# Tests for EndpointResult
def test_endpoint_result_success():
    """Test EndpointResult with successful requests"""
    result = EndpointResult(
        endpoint="GET /api/test",
        concurrent_requests=10,
        success_count=95,
        failure_count=5,
        avg_response_time=0.2,
        min_response_time=0.1,
        max_response_time=0.5,
        status_codes={"200": 95, "500": 5}
    )
    assert result.endpoint == "GET /api/test"
    assert result.concurrent_requests == 10
    assert result.success_count == 95
    assert result.failure_count == 5
    assert result.avg_response_time == 0.2
    assert result.min_response_time == 0.1
    assert result.max_response_time == 0.5
    assert result.status_codes == {"200": 95, "500": 5}
    assert result.error_message is None

def test_endpoint_result_with_error():
    """Test EndpointResult with error message"""
    result = EndpointResult(
        endpoint="POST /api/test",
        concurrent_requests=5,
        success_count=0,
        failure_count=5,
        avg_response_time=1.0,
        min_response_time=0.8,
        max_response_time=1.2,
        status_codes={"500": 5},
        error_message="Internal Server Error"
    )
    assert result.endpoint == "POST /api/test"
    assert result.concurrent_requests == 5
    assert result.success_count == 0
    assert result.failure_count == 5
    assert result.avg_response_time == 1.0
    assert result.min_response_time == 0.8
    assert result.max_response_time == 1.2
    assert result.status_codes == {"500": 5}
    assert result.error_message == "Internal Server Error"

def test_endpoint_result_invalid_negative_counts():
    """Test EndpointResult validation with negative counts"""
    with pytest.raises(ValidationError):
        EndpointResult(
            endpoint="GET /api/test",
            concurrent_requests=-1,  # Should be >= 0
            success_count=0,
            failure_count=0,
            avg_response_time=0.1,
            min_response_time=0.1,
            max_response_time=0.1,
            status_codes={}
        )

def test_endpoint_result_invalid_negative_times():
    """Test EndpointResult validation with negative times"""
    with pytest.raises(ValidationError):
        EndpointResult(
            endpoint="GET /api/test",
            concurrent_requests=1,
            success_count=0,
            failure_count=0,
            avg_response_time=-0.1,  # Should be >= 0
            min_response_time=0.1,
            max_response_time=0.1,
            status_codes={}
        )

def test_endpoint_result_invalid_time_relationship():
    """Test EndpointResult validation with min time greater than max time"""
    with pytest.raises(ValidationError):
        EndpointResult(
            endpoint="GET /api/test",
            concurrent_requests=1,
            success_count=0,
            failure_count=0,
            avg_response_time=0.2,
            min_response_time=0.3,  # Should be <= max_response_time
            max_response_time=0.1,
            status_codes={}
        )

# Tests for SessionInfo
def test_session_info_success():
    """Test SessionInfo with successful session"""
    session = SessionInfo(
        account="test_account",
        username="test_user",
        token_id="abc123",
        status="valid",
        acquired_at="2025-05-06T20:00:00Z",
        session_id="session123"
    )
    assert session.account == "test_account"
    assert session.username == "test_user"
    assert session.token_id == "abc123"
    assert session.status == "valid"
    assert session.acquired_at == "2025-05-06T20:00:00Z"
    assert session.session_id == "session123"
    assert session.error is None

def test_session_info_failure():
    """Test SessionInfo with failed session"""
    session = SessionInfo(
        status="failed",
        error="Authentication failed"
    )
    assert session.account is None
    assert session.username is None
    assert session.token_id is None
    assert session.status == "failed"
    assert session.acquired_at is None
    assert session.session_id is None
    assert session.error == "Authentication failed"

def test_session_info_minimal():
    """Test SessionInfo with minimal required fields"""
    session = SessionInfo(
        status="pending"
    )
    assert session.account is None
    assert session.username is None
    assert session.token_id is None
    assert session.status == "pending"
    assert session.acquired_at is None
    assert session.session_id is None
    assert session.error is None

def test_session_info_invalid_status():
    """Test SessionInfo with invalid status"""
    with pytest.raises(ValidationError):
        SessionInfo(
            status=""  # Empty status should fail
        )
