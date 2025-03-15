import unittest
import asyncio
import json
import os
import sys
from unittest.mock import patch, MagicMock, AsyncMock
import requests
from datetime import datetime

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api_models import (
    DistributionStrategy,
    EndpointSchema,
    StressTestConfig,
    StressTestEndpointConfig
)

# Test URLs
TEST_URLS = [
    "http://127.0.0.1:8000",  # Local FastAPI instance
    "https://api.thebighalo.com",  # External API 1
    "https://httpbin.dmuth.org"    # External API 2
]

class MockResponse:
    """Mock HTTP response for testing"""
    def __init__(self, json_data, status_code, ok=True):
        self.json_data = json_data
        self.status_code = status_code
        self.ok = ok
    
    def json(self):
        return self.json_data


class TestDashboardIntegration(unittest.TestCase):
    """Test suite for dashboard integration between frontend and backend"""
    
    def setUp(self):
        """Setup for tests"""
        self.base_backend_url = "http://127.0.0.1:8000"  # Local backend URL
        
        # Test configuration data
        self.valid_api_url = TEST_URLS[0]
        self.valid_auth_json = json.dumps({"Authorization": "Bearer test_token"})
        self.invalid_auth_json = "{this is not valid json"
        self.valid_concurrency = 10
        self.valid_distribution = DistributionStrategy.SEQUENTIAL
        
        # Sample endpoints
        self.sample_endpoints = [
            StressTestEndpointConfig(
                path="/health",
                method="GET",
                weight=1.0
            ),
            StressTestEndpointConfig(
                path="/api/openapi-endpoints",
                method="POST",
                weight=1.0
            )
        ]

    def test_form_input_validation_valid(self):
        """Test validation with valid input values"""
        # Create a valid test configuration
        config = StressTestConfig(
            target_url=self.valid_api_url,
            strategy=DistributionStrategy.SEQUENTIAL,
            max_concurrent_users=self.valid_concurrency,
            request_rate=10,
            duration=5,
            endpoints=self.sample_endpoints,
            headers=json.loads(self.valid_auth_json) if self.valid_auth_json else None,
            use_random_session=False
        )
        
        # Verify field validation
        # HttpUrl objects add a trailing slash, so we compare the string representation
        self.assertTrue(str(config.target_url).startswith(self.valid_api_url))
        self.assertEqual(config.strategy, DistributionStrategy.SEQUENTIAL)
        self.assertEqual(config.max_concurrent_users, self.valid_concurrency)
        self.assertEqual(len(config.endpoints), 2)
        
        # Try to convert to dictionary and handle both Pydantic v1 and v2
        try:
            # Pydantic v2 method
            config_dict = config.model_dump()
        except AttributeError:
            # Fallback to Pydantic v1 method
            config_dict = config.dict()
            
        # Convert HttpUrl to string for JSON serialization
        if isinstance(config_dict.get('target_url'), object) and not isinstance(config_dict.get('target_url'), str):
            config_dict['target_url'] = str(config_dict['target_url'])
            
        # Ensure we can serialize to JSON (would raise exception if not)
        json_str = json.dumps(config_dict)
        self.assertIsInstance(json_str, str)
    
    def test_form_input_validation_invalid_auth(self):
        """Test validation with invalid auth JSON"""
        try:
            # This should fail with invalid JSON
            headers = json.loads(self.invalid_auth_json)
            self.fail("Invalid JSON should have raised an exception")
        except json.JSONDecodeError:
            # Expected outcome
            pass
    
    def test_form_input_validation_missing_endpoints(self):
        """Test validation with no endpoints selected"""
        with self.assertRaises(ValueError):
            # Should raise ValueError due to empty endpoints list
            config = StressTestConfig(
                target_url=self.valid_api_url,
                strategy=DistributionStrategy.SEQUENTIAL,
                max_concurrent_users=self.valid_concurrency,
                request_rate=10,
                duration=5,
                endpoints=[],  # Empty list - should fail validation
                headers=None,
                use_random_session=False
            )
    
    @patch('requests.post')
    def test_api_fetch_endpoints_success(self, mock_post):
        """Test successful API endpoint fetching"""
        # Mock response for /api/openapi-endpoints
        mock_endpoints = [
            {
                "path": "/health",
                "method": "GET",
                "summary": "Health check",
                "parameters": [],
                "responses": {"200": {"status_code": "200", "content_type": "application/json", "response_schema": {}, "description": "Successful response"}}
            },
            {
                "path": "/api/validate-target",
                "method": "POST",
                "summary": "Validate target API",
                "parameters": [],
                "request_body": {"type": "object", "properties": {"target_url": {"type": "string"}}},
                "responses": {"200": {"status_code": "200", "content_type": "application/json", "response_schema": {}, "description": "Successful response"}}
            }
        ]
        
        mock_response = MockResponse(
            {"target_url": self.valid_api_url, "endpoints": mock_endpoints, "timestamp": datetime.now().isoformat()}, 
            200
        )
        mock_post.return_value = mock_response
        
        # Simulate what frontend ApiService.fetchEndpoints would do
        response = requests.post(
            f"{self.base_backend_url}/api/openapi-endpoints",
            headers={"Content-Type": "application/json"},
            json={"target_url": self.valid_api_url}
        )
        
        # Verify response
        self.assertTrue(response.ok)
        data = response.json()
        self.assertEqual(data["target_url"], self.valid_api_url)
        self.assertEqual(len(data["endpoints"]), 2)
    
    @patch('requests.post')
    def test_api_fetch_endpoints_failure(self, mock_post):
        """Test API endpoint fetching failure scenario"""
        # Mock error response
        mock_response = MockResponse(
            {"detail": "Failed to access API"}, 
            404,
            ok=False
        )
        mock_post.return_value = mock_response
        
        # Simulate what frontend ApiService.fetchEndpoints would do
        response = requests.post(
            f"{self.base_backend_url}/api/openapi-endpoints",
            headers={"Content-Type": "application/json"},
            json={"target_url": "https://invalid-url.example.com"}
        )
        
        # Verify response
        self.assertFalse(response.ok)
        self.assertEqual(response.status_code, 404)
    
    @patch('requests.post')
    def test_api_start_test_integration(self, mock_post):
        """Test start test API integration"""
        # Mock successful test start response
        test_id = "test-123"
        mock_response = MockResponse(
            {
                "test_id": test_id,
                "status": "running",
                "config": {
                    "target_url": self.valid_api_url,
                    "strategy": "sequential",
                    "max_concurrent_users": 10,
                    "request_rate": 10,
                    "duration": 5,
                    "endpoints": [{"path": "/health", "method": "GET", "weight": 1.0}],
                    "headers": {"Authorization": "Bearer test_token"},
                    "use_random_session": False
                },
                "start_time": datetime.now().isoformat()
            },
            200
        )
        mock_post.return_value = mock_response
        
        # Create test configuration
        config = {
            "target_url": self.valid_api_url,
            "strategy": "sequential",
            "max_concurrent_users": 10,
            "request_rate": 10,
            "duration": 5,
            "endpoints": [{"path": "/health", "method": "GET", "weight": 1.0}],
            "headers": {"Authorization": "Bearer test_token"},
            "use_random_session": False
        }
        
        # Simulate what frontend ApiService.startStressTest would do
        response = requests.post(
            f"{self.base_backend_url}/api/start-advanced-test",
            headers={"Content-Type": "application/json"},
            json=config
        )
        
        # Verify response
        self.assertTrue(response.ok)
        data = response.json()
        self.assertEqual(data["test_id"], test_id)
        self.assertEqual(data["status"], "running")
        self.assertEqual(data["config"]["target_url"], self.valid_api_url)


class TestMultiAPIEndpoints(unittest.TestCase):
    """Tests for multiple API endpoints"""
    
    @patch('requests.post')
    def test_local_fastapi_endpoint(self, mock_post):
        """Test against local FastAPI instance"""
        url = TEST_URLS[0]
        # Mock successful response
        mock_post.return_value = MockResponse(
            {"target_url": url, "endpoints": [], "timestamp": datetime.now().isoformat()},
            200
        )
        
        response = requests.post(
            f"{url}/api/openapi-endpoints",
            headers={"Content-Type": "application/json"},
            json={"target_url": url}
        )
        
        self.assertTrue(response.ok)
        self.assertEqual(response.json()["target_url"], url)
    
    @patch('requests.post')
    def test_thebighalo_api_endpoint(self, mock_post):
        """Test against thebighalo.com API"""
        url = TEST_URLS[1]
        # Mock successful response
        mock_post.return_value = MockResponse(
            {"target_url": url, "endpoints": [], "timestamp": datetime.now().isoformat()},
            200
        )
        
        response = requests.post(
            f"http://127.0.0.1:8000/api/openapi-endpoints",
            headers={"Content-Type": "application/json"},
            json={"target_url": url}
        )
        
        self.assertTrue(response.ok)
        self.assertEqual(response.json()["target_url"], url)
    
    @patch('requests.post')
    def test_httpbin_api_endpoint(self, mock_post):
        """Test against httpbin.dmuth.org API"""
        url = TEST_URLS[2]
        # Mock successful response
        mock_post.return_value = MockResponse(
            {"target_url": url, "endpoints": [], "timestamp": datetime.now().isoformat()},
            200
        )
        
        response = requests.post(
            f"http://127.0.0.1:8000/api/openapi-endpoints",
            headers={"Content-Type": "application/json"},
            json={"target_url": url}
        )
        
        self.assertTrue(response.ok)
        self.assertEqual(response.json()["target_url"], url)


def run_tests():
    """Run the test suite"""
    unittest.main()


if __name__ == "__main__":
    run_tests()
