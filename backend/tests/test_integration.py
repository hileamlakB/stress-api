import sys
import os
from pathlib import Path

# Add the parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import pytest
import asyncio
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
from enum import Enum
from pydantic import BaseModel, Field, HttpUrl

# Import our mock FastAPI app
from backend.tests.mock_main import app

client = TestClient(app)

@pytest.mark.asyncio
async def test_complete_stress_test_flow():
    """
    Integration test that runs through a complete stress test flow:
    1. Validate target API
    2. Start stress test
    3. Monitor progress
    4. Get final results
    """
    # Step 1: Validate target API
    validation_response = client.post(
        "/api/validate",
        json={
            "target_url": "https://httpbin.org"
        }
    )
    assert validation_response.status_code == 200
    validation_data = validation_response.json()
    assert validation_data["status"] == "valid"

    # Step 2: Configure and start stress test
    test_config = {
        "target_url": "https://httpbin.org",
        "strategy": "sequential",
        "max_concurrent_users": 5,
        "request_rate": 2,
        "duration": 10,
        "endpoints": [
            {
                "path": "/get",
                "method": "GET",
                "weight": 1.0
            }
        ]
    }
    
    start_response = client.post("/api/stress-test/task", json=test_config)
    assert start_response.status_code == 200
    start_data = start_response.json()
    task_id = start_data["task_id"]
    assert task_id is not None

    # Step 3: Monitor progress
    status_response = client.get(f"/api/tasks/{task_id}")
    assert status_response.status_code == 200
    status_data = status_response.json()
    assert status_data["status"] == "completed"

    # Step 4: Verify results
    results = status_data.get("results", {})
    assert "endpoints" in results
    assert len(results["endpoints"]) > 0
    
    endpoint_result = results["endpoints"][0]
    assert endpoint_result["endpoint"] == "GET /get"
    assert endpoint_result["success_count"] >= 0
    assert endpoint_result["failure_count"] >= 0
    assert endpoint_result["avg_response_time"] > 0

@pytest.mark.asyncio
async def test_advanced_multi_endpoint_test():
    """
    Integration test for a more complex stress test scenario:
    1. Multiple endpoints with different weights
    2. Custom headers and parameters
    3. Random distribution strategy
    4. Session handling
    """
    # Step 1: Configure advanced test
    test_config = {
        "target_url": "https://httpbin.org",
        "strategy": "random",
        "max_concurrent_users": 10,
        "request_rate": 5,
        "duration": 15,
        "headers": {
            "Custom-Header": "test-value",
            "Accept": "application/json"
        },
        "use_random_session": True,
        "endpoints": [
            {
                "path": "/get",
                "method": "GET",
                "weight": 2.0,
                "custom_parameters": {
                    "timeout": 5
                }
            },
            {
                "path": "/status/200",
                "method": "GET",
                "weight": 1.0
            }
        ]
    }
    
    # Start the test
    start_response = client.post("/api/stress-test/task", json=test_config)
    assert start_response.status_code == 200
    start_data = start_response.json()
    task_id = start_data["task_id"]
    assert task_id is not None

    # Get task status
    status_response = client.get(f"/api/tasks/{task_id}")
    assert status_response.status_code == 200
    status_data = status_response.json()
    assert status_data["status"] == "completed"
        
    # Check session status
    session_response = client.get(f"/api/sessions/{task_id}")
    assert session_response.status_code == 200
    session_data = session_response.json()
    assert "sessions" in session_data
    assert len(session_data["sessions"]) > 0
    assert session_data["sessions"][0]["status"] == "valid"

    # Verify detailed results
    results = status_data.get("results", {})
    assert "endpoints" in results
    assert len(results["endpoints"]) == 2
    
    # Verify GET /get endpoint results
    get_result = next(r for r in results["endpoints"] if r["endpoint"] == "GET /get")
    assert get_result["success_count"] >= 0
    assert get_result["avg_response_time"] > 0
    assert "200" in get_result["status_codes"]
    
    # Verify GET /status/200 endpoint results
    status_result = next(r for r in results["endpoints"] if r["endpoint"] == "GET /status/200")
    assert status_result["success_count"] >= 0
    assert status_result["avg_response_time"] > 0
    assert "200" in status_result["status_codes"]

@pytest.mark.asyncio
async def test_error_handling():
    """
    Integration test for error handling:
    1. Test invalid task ID
    2. Test invalid session ID
    """
    # Test invalid task ID
    status_response = client.get("/api/tasks/invalid_task_id")
    assert status_response.status_code == 404
    
    # Test invalid session ID
    session_response = client.get("/api/sessions/invalid_session_id")
    assert session_response.status_code == 404
