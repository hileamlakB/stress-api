import unittest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
import sys
import os
import json
from datetime import datetime

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from api_models import TestStatus


class TestAPIEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        
    def test_health_endpoint(self):
        """Test the health check endpoint"""
        # Execute
        response = self.client.get("/health")
        
        # Assert
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("timestamp", data)
        self.assertIn("version", data)
        
    @patch('openapi_parser.OpenAPIParser.fetch_openapi_spec')
    def test_validate_target_success(self, mock_fetch):
        """Test validating a target API successfully"""
        # Setup
        mock_fetch.return_value = {"openapi": "3.0.0"}
        
        # Execute
        response = self.client.post(
            "/api/validate-target", 
            json={"target_url": "https://example.com"}
        )
        
        # Assert
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "valid")
        self.assertTrue(data["openapi_available"])
        
    @patch('openapi_parser.OpenAPIParser.fetch_openapi_spec')
    @patch('openapi_parser.OpenAPIParser.parse_schema')
    def test_get_openapi_endpoints(self, mock_parse, mock_fetch):
        """Test getting OpenAPI endpoints"""
        # Setup
        mock_fetch.return_value = {"openapi": "3.0.0"}
        
        # Create sample endpoints
        mock_endpoint = MagicMock()
        mock_endpoint.path = "/users"
        mock_endpoint.method = "GET"
        mock_endpoint.summary = "Get all users"
        mock_endpoint.dict = MagicMock(return_value={
            "path": "/users",
            "method": "GET",
            "summary": "Get all users",
            "parameters": []
        })
        mock_parse.return_value = [mock_endpoint]
        
        # Execute
        response = self.client.post(
            "/api/openapi-endpoints",
            json={"target_url": "https://example.com"}
        )
        
        # Assert
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["target_url"], "https://example.com")
        self.assertEqual(len(data["endpoints"]), 1)
        self.assertEqual(data["endpoints"][0]["path"], "/users")
        self.assertEqual(data["endpoints"][0]["method"], "GET")
        
    @patch('data_generator.RequestDataGenerator.generate_request_data')
    @patch('data_generator.RequestDataGenerator.generate_primitive')
    def test_generate_sample_data(self, mock_generate_primitive, mock_generate_request_data):
        """Test generating sample data for an endpoint"""
        # Setup
        mock_generate_request_data.return_value = {"name": "John", "email": "john@example.com"}
        mock_generate_primitive.return_value = "value"
        
        # Prepare test data
        endpoint_data = {
            "path": "/users",
            "method": "POST",
            "summary": "Create a user",
            "parameters": [
                {
                    "name": "limit",
                    "location": "query",
                    "required": False,
                    "schema": {"type": "integer"}
                }
            ],
            "request_body": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "email": {"type": "string", "format": "email"}
                },
                "required": ["name", "email"]
            }
        }
        
        # Execute
        response = self.client.post(
            "/api/generate-sample-data",
            json=endpoint_data
        )
        
        # Assert
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["endpoint"], "POST /users")
        self.assertIn("request_body", data)
        self.assertIn("parameters", data)
        self.assertEqual(data["request_body"], {"name": "John", "email": "john@example.com"})
        self.assertIn("limit", data["parameters"])
        
    @patch('stress_tester.StressTester.run_test')
    def test_start_test(self, mock_run_test):
        """Test starting a stress test"""
        # Setup
        mock_run_test.return_value = []
        
        # Test data
        test_config = {
            "target_url": "https://example.com",
            "concurrent_users": 10,
            "request_rate": 5,
            "duration": 60,
            "endpoints": ["/users", "/products"],
            "headers": {"Authorization": "Bearer token"}
        }
        
        # Execute
        response = self.client.post(
            "/api/start-test",
            json=test_config
        )
        
        # Assert
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("test_id", data)
        self.assertEqual(data["status"], TestStatus.RUNNING)
        self.assertEqual(data["config"], test_config)
        self.assertIn("start_time", data)
        
    @patch('stress_tester.StressTester.get_results')
    def test_get_test_results(self, mock_get_results):
        """Test getting test results"""
        # Setup
        mock_get_results.return_value = [
            {
                "timestamp": datetime.now().isoformat(),
                "response_time": 0.1,
                "status_code": 200,
                "success": True,
                "error_message": None
            },
            {
                "timestamp": datetime.now().isoformat(),
                "response_time": 0.2,
                "status_code": 200,
                "success": True,
                "error_message": None
            }
        ]
        
        # Execute
        response = self.client.get("/api/test-results/test-123")
        
        # Assert
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["test_id"], "test-123")
        self.assertEqual(len(data["results"]), 2)
        self.assertIn("summary", data)
        self.assertEqual(data["summary"]["total_requests"], 2)
        self.assertEqual(data["summary"]["successful_requests"], 2)
        
    @patch('stress_tester.StressTester.stop_test')
    def test_stop_test(self, mock_stop_test):
        """Test stopping a test"""
        # Setup
        mock_stop_test.return_value = True
        
        # Execute
        response = self.client.post("/api/stop-test/test-123")
        
        # Assert
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["test_id"], "test-123")
        self.assertEqual(data["status"], TestStatus.STOPPED)
        self.assertIn("stop_time", data)
        
    @patch('stress_tester.StressTester.stop_test')
    def test_stop_nonexistent_test(self, mock_stop_test):
        """Test stopping a nonexistent test"""
        # Setup
        mock_stop_test.return_value = False
        
        # Execute
        response = self.client.post("/api/stop-test/nonexistent")
        
        # Assert
        self.assertEqual(response.status_code, 404)
        
    @patch('stress_tester.StressTester.run_advanced_test')
    @patch('openapi_parser.OpenAPIParser.fetch_openapi_spec')
    @patch('openapi_parser.OpenAPIParser.parse_schema')
    def test_start_advanced_test(self, mock_parse, mock_fetch, mock_run_advanced):
        """Test starting an advanced stress test"""
        # Setup
        mock_fetch.return_value = {"openapi": "3.0.0"}
        
        # Create sample endpoint
        mock_endpoint = MagicMock()
        mock_endpoint.method = "GET"
        mock_endpoint.path = "/users"
        mock_endpoint.parameters = []
        mock_endpoint.dict = MagicMock(return_value={
            "path": "/users",
            "method": "GET", 
            "parameters": []
        })
        mock_parse.return_value = [mock_endpoint]
        
        # Configure run_advanced_test to be awaitable but not actually wait
        mock_run_advanced.return_value = {}
        
        # Test data
        test_config = {
            "target_url": "https://example.com",
            "strategy": "interleaved",
            "max_concurrent_users": 100,
            "request_rate": 10,
            "duration": 60,
            "endpoints": [
                {
                    "path": "/users",
                    "method": "GET",
                    "weight": 2.0
                },
                {
                    "path": "/products",
                    "method": "GET",
                    "weight": 1.0
                }
            ],
            "headers": {"Authorization": "Bearer token"}
        }
        
        # Execute
        response = self.client.post(
            "/api/advanced-test",
            json=test_config
        )
        
        # Assert
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("test_id", data)
        self.assertEqual(data["status"], TestStatus.RUNNING)
        self.assertIn("start_time", data)


if __name__ == '__main__':
    unittest.main() 