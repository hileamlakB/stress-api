import asyncio
import aiohttp
import time
import statistics
from typing import List, Dict
import json
import random
from datetime import datetime
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import subprocess
import sys
import os
import signal
from contextlib import contextmanager

@contextmanager
def run_api_server():
    """Context manager to run the FastAPI server during tests"""
    # Start the server
    server = subprocess.Popen(
        ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    # Wait for server to start
    time.sleep(2)
    try:
        yield server
    finally:
        # Shutdown the server
        server.terminate()
        server.wait()

class LoadTester:
    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url
        self.results: List[Dict] = []

    async def make_request(self, session: aiohttp.ClientSession, endpoint: str, 
                         method: str = "GET", data: dict = None, 
                         headers: dict = None) -> Dict:
        start_time = time.time()
        try:
            if method == "GET":
                async with session.get(f"{self.base_url}{endpoint}", 
                                     headers=headers) as response:
                    await response.json()
            else:
                async with session.post(f"{self.base_url}{endpoint}", 
                                      json=data, headers=headers) as response:
                    await response.json()
            
            end_time = time.time()
            return {
                "endpoint": endpoint,
                "method": method,
                "status": response.status,
                "response_time": end_time - start_time,
                "timestamp": datetime.now().isoformat(),
                "success": 200 <= response.status < 300
            }
        except Exception as e:
            end_time = time.time()
            return {
                "endpoint": endpoint,
                "method": method,
                "status": 500,
                "response_time": end_time - start_time,
                "timestamp": datetime.now().isoformat(),
                "success": False,
                "error": str(e)
            }

    async def run_load_test(self, concurrent_users: int, duration_seconds: int, 
                           endpoint: str, method: str = "GET", data: dict = None, 
                           headers: dict = None):
        if headers is None:
            headers = {}
        headers["Content-Type"] = "application/json"
        
        async with aiohttp.ClientSession() as session:
            start_time = time.time()
            tasks = []
            
            while time.time() - start_time < duration_seconds:
                for _ in range(concurrent_users):
                    if data and isinstance(data, dict):
                        # Create a new copy of data for each request
                        request_data = data.copy()
                        if "user_id" in request_data:
                            request_data["user_id"] = random.randint(1, 100)
                        if "sku" in request_data:
                            request_data["sku"] = f"TEST{random.randint(1000, 9999)}"
                    else:
                        request_data = data
                        
                    task = asyncio.create_task(
                        self.make_request(session, endpoint, method, request_data, headers)
                    )
                    tasks.append(task)
                
                batch_results = await asyncio.gather(*tasks)
                self.results.extend(batch_results)
                tasks = []
                
                # Small delay to prevent overwhelming the server
                await asyncio.sleep(0.1)

    def analyze_results(self) -> Dict:
        if not self.results:
            return {"error": "No results to analyze"}

        response_times = [r["response_time"] for r in self.results]
        success_count = sum(1 for r in self.results if r["success"])
        success_rate = (success_count / len(self.results)) * 100
        
        analysis = {
            "total_requests": len(self.results),
            "success_rate": success_rate,
            "response_time": {
                "min": min(response_times),
                "max": max(response_times),
                "mean": statistics.mean(response_times),
                "median": statistics.median(response_times),
                "p95": statistics.quantiles(response_times, n=20)[18],  # 95th percentile
                "p99": statistics.quantiles(response_times, n=100)[98]  # 99th percentile
            },
            "status_codes": {}
        }

        # Count status codes
        for result in self.results:
            status = result["status"]
            analysis["status_codes"][status] = analysis["status_codes"].get(status, 0) + 1

        return analysis

    def plot_results(self, output_file: str = "load_test_results.png"):
        if not self.results:
            return

        # Convert results to DataFrame
        df = pd.DataFrame(self.results)
        
        # Create subplots
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
        
        # Response time distribution
        sns.histplot(data=df, x="response_time", bins=50, ax=ax1)
        ax1.set_title("Response Time Distribution")
        ax1.set_xlabel("Response Time (seconds)")
        ax1.set_ylabel("Count")
        
        # Response time over time
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        sns.scatterplot(data=df, x="timestamp", y="response_time", hue="status", ax=ax2)
        ax2.set_title("Response Time Over Time")
        ax2.set_xlabel("Time")
        ax2.set_ylabel("Response Time (seconds)")
        
        plt.tight_layout()
        plt.savefig(output_file)
        plt.close()

async def main():
    # Test configurations
    test_scenarios = [
        {
            "name": "Basic GET endpoint",
            "endpoint": "/",
            "method": "GET",
            "users": 10,
            "duration": 10
        },
        {
            "name": "User creation load test",
            "endpoint": "/users/",
            "method": "POST",
            "users": 20,
            "duration": 15,
            "data": {
                "username": f"user_{random.randint(1000, 9999)}",
                "email": f"user_{random.randint(1000, 9999)}@example.com",
                "role": "user",
                "password": "testpass123"
            }
        },
        {
            "name": "Product search load test",
            "endpoint": "/products/search",
            "method": "GET",
            "users": 15,
            "duration": 10,
            "params": {
                "query": "test",
                "min_price": 10,
                "max_price": 1000,
                "limit": 10
            }
        },
        {
            "name": "Order creation load test",
            "endpoint": "/orders/",
            "method": "POST",
            "users": 10,
            "duration": 10,
            "data": {
                "user_id": random.randint(1, 100),
                "items": [
                    {
                        "product_id": random.randint(1, 100),
                        "quantity": random.randint(1, 5),
                        "unit_price": random.uniform(10, 100)
                    }
                ],
                "shipping_address": "123 Test St, Test City"
            }
        }
    ]

    with run_api_server():
        # Run load tests for each scenario
        for scenario in test_scenarios:
            print(f"\nRunning load test for: {scenario['name']}")
            tester = LoadTester()
            
            # Add query parameters to endpoint if present
            if "params" in scenario:
                params = "&".join(f"{k}={v}" for k, v in scenario["params"].items())
                scenario["endpoint"] = f"{scenario['endpoint']}?{params}"
            
            await tester.run_load_test(
                concurrent_users=scenario["users"],
                duration_seconds=scenario["duration"],
                endpoint=scenario["endpoint"],
                method=scenario["method"],
                data=scenario.get("data"),
                headers={"Content-Type": "application/json"}
            )
            
            # Analyze and display results
            analysis = tester.analyze_results()
            print("\nTest Results:")
            print(json.dumps(analysis, indent=2))
            
            # Generate plots
            tester.plot_results(f"load_test_{scenario['name'].lower().replace(' ', '_')}.png")

if __name__ == "__main__":
    asyncio.run(main())
