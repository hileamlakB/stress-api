import asyncio
import httpx
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StressTester:
    def __init__(self):
        self.active_tests = {}
        self.results = {}

    async def execute_request(self, client: httpx.AsyncClient, url: str, method: str = "GET",
                            headers: Optional[Dict[str, str]] = None,
                            data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        start_time = time.time()
        try:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                json=data
            )
            response_time = time.time() - start_time
            return {
                "timestamp": datetime.now().isoformat(),
                "response_time": response_time,
                "status_code": response.status_code,
                "success": response.status_code < 400,
                "error_message": None
            }
        except Exception as e:
            response_time = time.time() - start_time
            return {
                "timestamp": datetime.now().isoformat(),
                "response_time": response_time,
                "status_code": 0,
                "success": False,
                "error_message": str(e)
            }

    async def run_test(self, test_id: str, target_url: str, concurrent_users: int,
                      request_rate: int, duration: int, endpoints: List[str],
                      headers: Optional[Dict[str, str]] = None,
                      payload_data: Optional[Dict[str, Any]] = None):
        self.active_tests[test_id] = True
        self.results[test_id] = []
        
        async with httpx.AsyncClient() as client:
            start_time = time.time()
            request_interval = 1.0 / request_rate if request_rate > 0 else 0
            
            while time.time() - start_time < duration and self.active_tests.get(test_id, False):
                tasks = []
                for endpoint in endpoints:
                    for _ in range(concurrent_users):
                        task = self.execute_request(
                            client=client,
                            url=f"{target_url.rstrip('/')}/{endpoint.lstrip('/')}",
                            headers=headers,
                            data=payload_data
                        )
                        tasks.append(task)
                
                results = await asyncio.gather(*tasks)
                self.results[test_id].extend(results)
                
                if request_interval > 0:
                    await asyncio.sleep(request_interval)
        
        self.active_tests[test_id] = False
        return self.results[test_id]

    def stop_test(self, test_id: str):
        if test_id in self.active_tests:
            self.active_tests[test_id] = False
            return True
        return False

    def get_results(self, test_id: str) -> List[Dict[str, Any]]:
        return self.results.get(test_id, [])
