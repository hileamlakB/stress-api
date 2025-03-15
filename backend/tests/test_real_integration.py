import unittest
import json
import os
import sys
import requests
from datetime import datetime

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api_models import DistributionStrategy

# Test URLs - update as needed
LOCAL_API = "http://127.0.0.1:8000"
TEST_APIS = [
    LOCAL_API,
    "https://api.thebighalo.com",
    "https://httpbin.dmuth.org"
]

class TestRealIntegration(unittest.TestCase):
    """Integration tests against real APIs - run these when the backend server is running"""
    
    def setUp(self):
        """Setup for tests"""
        self.backend_url = LOCAL_API
        
    def test_health_endpoint(self):
        """Test the health endpoint of the backend"""
        try:
            response = requests.get(f"{self.backend_url}/health")
            self.assertTrue(response.ok)
            data = response.json()
            self.assertEqual(data["status"], "healthy")
            print(f"✓ Backend health check successful: {data}")
        except Exception as e:
            self.fail(f"Backend health check failed: {str(e)}")
    
    def test_fetch_local_endpoints(self):
        """Test fetching endpoints from the local backend"""
        try:
            response = requests.post(
                f"{self.backend_url}/api/openapi-endpoints",
                headers={"Content-Type": "application/json"},
                json={"target_url": self.backend_url}
            )
            self.assertTrue(response.ok)
            data = response.json()
            endpoints = data["endpoints"]
            self.assertGreater(len(endpoints), 0)
            print(f"✓ Successfully fetched {len(endpoints)} endpoints from local backend")
            # Print some endpoints for verification
            for i, endpoint in enumerate(endpoints[:3]):
                print(f"  Endpoint {i+1}: {endpoint['method']} {endpoint['path']}")
                if i >= 2:
                    print("  ...")
                    break
        except Exception as e:
            self.fail(f"Endpoint fetching failed: {str(e)}")
    
    def test_validate_target_endpoints(self):
        """Test validating target endpoints"""
        for api_url in TEST_APIS:
            try:
                print(f"\nTesting target validation for: {api_url}")
                response = requests.post(
                    f"{self.backend_url}/api/validate-target",
                    headers={"Content-Type": "application/json"},
                    json={"target_url": api_url}
                )
                
                if response.ok:
                    data = response.json()
                    print(f"✓ Target validation successful: {data['status']}")
                    print(f"  Message: {data['message']}")
                    print(f"  OpenAPI available: {data['openapi_available']}")
                else:
                    print(f"✗ Target validation failed with status {response.status_code}")
                    print(f"  Error: {response.text}")
            except Exception as e:
                print(f"✗ Test exception: {str(e)}")
    
    def test_full_api_workflow(self):
        """Test a complete workflow from start to finish"""
        try:
            # Step 1: Validate target
            print("\nTesting full workflow with local API...")
            print("Step 1: Validating target")
            response = requests.post(
                f"{self.backend_url}/api/validate-target",
                headers={"Content-Type": "application/json"},
                json={"target_url": self.backend_url}
            )
            self.assertTrue(response.ok)
            
            # Step 2: Fetch endpoints
            print("Step 2: Fetching endpoints")
            response = requests.post(
                f"{self.backend_url}/api/openapi-endpoints",
                headers={"Content-Type": "application/json"},
                json={"target_url": self.backend_url}
            )
            self.assertTrue(response.ok)
            endpoints_data = response.json()
            
            # Select a few endpoints for testing
            test_endpoints = []
            for endpoint in endpoints_data["endpoints"][:2]:  # Just use first 2 endpoints
                test_endpoints.append({
                    "path": endpoint["path"],
                    "method": endpoint["method"],
                    "weight": 1.0
                })
            
            if not test_endpoints:
                print("No endpoints found to test, skipping remaining steps")
                return
            
            # Step 3: Start a test
            print(f"Step 3: Starting test with {len(test_endpoints)} endpoints")
            test_config = {
                "target_url": self.backend_url,
                "strategy": DistributionStrategy.SEQUENTIAL,
                "max_concurrent_users": 2,  # Low for quick testing
                "request_rate": 5,
                "duration": 3,  # Short duration
                "endpoints": test_endpoints,
                "headers": {},
                "use_random_session": False
            }
            
            response = requests.post(
                f"{self.backend_url}/api/advanced-test",
                headers={"Content-Type": "application/json"},
                json=test_config
            )
            
            # Debug information if response is not OK
            if not response.ok:
                print(f"\n✗ Error starting test: Status code {response.status_code}")
                print(f"  Response: {response.text}")
                print(f"  Test config: {json.dumps(test_config, indent=2)}")
            
            self.assertTrue(response.ok)
            test_data = response.json()
            test_id = test_data["test_id"]
            print(f"✓ Test started with ID: {test_id}")
            
            # Step 4: Wait a moment and check progress
            import time
            print("Step 4: Waiting for test to process...")
            time.sleep(2)  # Give it a couple seconds to process
            
            response = requests.get(f"{self.backend_url}/api/advanced-test/{test_id}/progress")
            
            # Debug information if response is not OK
            if not response.ok:
                print(f"\n✗ Error getting test progress: Status code {response.status_code}")
                print(f"  Response: {response.text}")
                print(f"  URL: {self.backend_url}/api/advanced-test/{test_id}/progress")
            
            self.assertTrue(response.ok)
            progress_data = response.json()
            print(f"✓ Test progress: {progress_data['status']}")
            print(f"  Elapsed time: {progress_data['elapsed_time']:.2f} seconds")
            print(f"  Completed requests: {progress_data['completed_requests']}")
            
            # Step 5: Get test results
            time.sleep(3)  # Give it a bit more time to finish
            print("Step 5: Getting test results")
            response = requests.get(f"{self.backend_url}/api/advanced-test/{test_id}/results")
            
            # Debug information if response is not OK
            if not response.ok:
                print(f"\n✗ Error getting test results: Status code {response.status_code}")
                print(f"  Response: {response.text}")
                print(f"  URL: {self.backend_url}/api/advanced-test/{test_id}/results")
            
            if response.ok:
                results_data = response.json()
                status = results_data.get("status", "unknown")
                print(f"✓ Test completed with status: {status}")
                
                # Display some results if available
                if "results" in results_data and results_data["results"]:
                    print("  Results:")
                    for i, result in enumerate(results_data["results"]):
                        print(f"    {result['endpoint']}: {result['success_count']} successes, "
                              f"{result['failure_count']} failures, "
                              f"avg time: {result['avg_response_time']:.4f}s")
                else:
                    print("  No detailed results available yet")
            else:
                print(f"✗ Failed to get results: {response.status_code}")
                print(f"  Error: {response.text}")
            
            print("\nFull workflow test completed")
            
        except Exception as e:
            self.fail(f"Workflow test failed: {str(e)}")


def run_live_tests():
    """Run the live integration tests"""
    print("\n========== RUNNING LIVE INTEGRATION TESTS ==========")
    print("These tests require the backend server to be running.")
    print(f"Backend URL: {LOCAL_API}")
    print("=======================================================\n")
    unittest.main()


if __name__ == "__main__":
    run_live_tests()
