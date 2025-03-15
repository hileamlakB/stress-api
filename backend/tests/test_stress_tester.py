import unittest
import asyncio
import httpx
from unittest.mock import patch, MagicMock, AsyncMock
import sys
import os
from datetime import datetime

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from stress_tester import StressTester
from api_models import DistributionStrategy, EndpointResult


class TestStressTester(unittest.TestCase):
    def setUp(self):
        self.stress_tester = StressTester()
        self.test_id = "test-123"
        
    async def async_setup(self):
        """Setup for async tests"""
        self.stress_tester = StressTester()
        self.test_id = "test-123"
        
    def test_initialization(self):
        """Test the initialization of StressTester"""
        self.assertEqual(self.stress_tester.active_tests, {})
        self.assertEqual(self.stress_tester.results, {})
        self.assertEqual(self.stress_tester.test_configs, {})
        self.assertEqual(self.stress_tester.test_start_times, {})
        self.assertEqual(self.stress_tester.test_end_times, {})
        self.assertEqual(self.stress_tester.completed_requests, {})
        
    def test_stop_test(self):
        """Test stopping a test"""
        # Setup
        self.stress_tester.active_tests[self.test_id] = True
        
        # Execute
        result = self.stress_tester.stop_test(self.test_id)
        
        # Assert
        self.assertTrue(result)
        self.assertFalse(self.stress_tester.active_tests[self.test_id])
        
    def test_stop_nonexistent_test(self):
        """Test stopping a test that doesn't exist"""
        # Execute
        result = self.stress_tester.stop_test("nonexistent-test")
        
        # Assert
        self.assertFalse(result)
        
    def test_get_results_nonexistent(self):
        """Test getting results for a test that doesn't exist"""
        # Execute
        results = self.stress_tester.get_results("nonexistent-test")
        
        # Assert
        self.assertEqual(results, [])
        
    def test_get_advanced_results_nonexistent(self):
        """Test getting advanced results for a test that doesn't exist"""
        # Execute
        results = self.stress_tester.get_advanced_results("nonexistent-test")
        
        # Assert
        self.assertEqual(results, {})
        
    def test_get_test_progress_nonexistent(self):
        """Test getting progress for a test that doesn't exist"""
        # Execute
        progress = self.stress_tester.get_test_progress("nonexistent-test")
        
        # Assert
        self.assertEqual(progress["status"], "not_found")
        self.assertEqual(progress["elapsed_time"], 0)
        self.assertEqual(progress["completed_requests"], 0)
        self.assertFalse(progress["results_available"])
        
    @patch('stress_tester.StressTester._process_endpoint_results')
    async def test_run_concurrent_batch(self, mock_process_results):
        """Test running a concurrent batch of requests"""
        # Setup
        await self.async_setup()
        client = MagicMock()
        
        # Mock the execute_request method to return a successful result
        self.stress_tester.execute_request = AsyncMock(return_value={
            "timestamp": datetime.now().isoformat(),
            "response_time": 0.1,
            "status_code": 200,
            "success": True,
            "error_message": None
        })
        
        # Mock the process_endpoint_results method
        mock_endpoint_result = EndpointResult(
            endpoint="GET /test",
            concurrent_requests=2,
            success_count=2,
            failure_count=0,
            avg_response_time=0.1,
            min_response_time=0.05,
            max_response_time=0.15,
            status_codes={"200": 2}
        )
        mock_process_results.return_value = mock_endpoint_result
        
        # Execute
        result = await self.stress_tester._run_concurrent_batch(
            client=client,
            target_url="https://example.com",
            endpoint_path="/test",
            endpoint_method="GET",
            concurrent_requests=2
        )
        
        # Assert
        self.assertEqual(result, mock_endpoint_result)
        self.assertEqual(mock_process_results.call_count, 1)
        self.assertEqual(self.stress_tester.execute_request.call_count, 2)
        
    def test_process_endpoint_results(self):
        """Test processing raw results into an EndpointResult"""
        # Setup
        endpoint_key = "GET /test"
        concurrent_requests = 2
        results = [
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
        result = self.stress_tester._process_endpoint_results(endpoint_key, concurrent_requests, results)
        
        # Assert
        self.assertEqual(result.endpoint, endpoint_key)
        self.assertEqual(result.concurrent_requests, concurrent_requests)
        self.assertEqual(result.success_count, 2)
        self.assertEqual(result.failure_count, 0)
        self.assertAlmostEqual(result.avg_response_time, 0.15, places=10)
        self.assertEqual(result.min_response_time, 0.1)
        self.assertEqual(result.max_response_time, 0.2)
        self.assertEqual(result.status_codes, {"200": 2})
        

# Helper to run async tests
def run_async_test(coro):
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(coro)


if __name__ == '__main__':
    unittest.main() 