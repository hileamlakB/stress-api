import sys
import os
from pathlib import Path

# Add the parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import pytest
from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Dict, Any, Optional
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

class StressTestEndpointConfig(BaseModel):
    path: str = Field(..., description="Endpoint path")
    method: str = Field(..., description="HTTP method")
    weight: Optional[float] = Field(1.0, description="Weight for distribution strategies")

class StressTestConfig(BaseModel):
    target_url: HttpUrl = Field(..., description="URL of the target API to test")
    strategy: DistributionStrategy = Field(DistributionStrategy.SEQUENTIAL, description="Distribution strategy")
    max_concurrent_users: int = Field(..., ge=1, le=1000, description="Maximum number of concurrent users")
    request_rate: int = Field(..., ge=1, description="Number of requests per second")
    duration: int = Field(..., ge=1, description="Test duration in seconds")
    endpoints: List[StressTestEndpointConfig] = Field(..., min_length=1, description="List of endpoints to test")

def test_task_status_enum():
    """Test the TaskStatus enum values"""
    assert TaskStatus.PENDING == "pending"
    assert TaskStatus.RUNNING == "running"
    assert TaskStatus.COMPLETED == "completed"
    assert TaskStatus.FAILED == "failed"
    assert TaskStatus.CANCELED == "canceled"

def test_stress_test_config():
    """Test StressTestConfig validation"""
    config = StressTestConfig(
        target_url="https://api.example.com",
        strategy=DistributionStrategy.SEQUENTIAL,
        max_concurrent_users=10,
        request_rate=5,
        duration=30,
        endpoints=[
            StressTestEndpointConfig(
                path="/test",
                method="GET",
                weight=1.0
            )
        ]
    )
    # HttpUrl adds a trailing slash if not present
    assert str(config.target_url).rstrip("/") == "https://api.example.com"
    assert config.strategy == DistributionStrategy.SEQUENTIAL
    assert config.max_concurrent_users == 10
    assert config.request_rate == 5
    assert config.duration == 30
    assert len(config.endpoints) == 1
    assert config.endpoints[0].path == "/test"
    assert config.endpoints[0].method == "GET"

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

def test_stress_test_endpoint_config():
    """Test StressTestEndpointConfig validation"""
    config = StressTestEndpointConfig(
        path="/api/test",
        method="POST",
        weight=2.5
    )
    assert config.path == "/api/test"
    assert config.method == "POST"
    assert config.weight == 2.5
