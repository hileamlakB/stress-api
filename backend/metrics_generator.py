import asyncio
import random
import time
from typing import Dict, List, Optional
from dataclasses import dataclass
from fastapi import WebSocket

@dataclass
class EndpointMetrics:
    endpoint: str
    concurrent_requests: int
    avg_response_time: float
    min_response_time: float
    max_response_time: float
    success_rate: float

class MetricsGenerator:
    def __init__(self):
        self.active_tests: Dict[str, Dict] = {}
        self.endpoint_patterns = [
            ('/api/users', {'base_latency': 50, 'latency_factor': 0.5, 'error_factor': 0.01}),
            ('/api/products', {'base_latency': 75, 'latency_factor': 0.8, 'error_factor': 0.015}),
            ('/api/orders', {'base_latency': 100, 'latency_factor': 1.2, 'error_factor': 0.02}),
            ('/api/search', {'base_latency': 150, 'latency_factor': 2.0, 'error_factor': 0.025}),
            ('/api/auth', {'base_latency': 30, 'latency_factor': 0.3, 'error_factor': 0.005}),
        ]

    def start_test(self, test_id: str, num_endpoints: Optional[int] = None):
        """Start a new test simulation."""
        if num_endpoints is None:
            num_endpoints = random.randint(2, len(self.endpoint_patterns))
        
        selected_endpoints = random.sample(self.endpoint_patterns, num_endpoints)
        
        self.active_tests[test_id] = {
            'start_time': time.time(),
            'endpoints': selected_endpoints,
            'concurrent_requests': {endpoint: 1 for endpoint, _ in selected_endpoints}
        }

    def stop_test(self, test_id: str):
        """Stop a test simulation."""
        if test_id in self.active_tests:
            del self.active_tests[test_id]

    def generate_metrics(self, test_id: str) -> List[EndpointMetrics]:
        """Generate metrics for a running test."""
        if test_id not in self.active_tests:
            return []

        test_data = self.active_tests[test_id]
        metrics = []

        # Update concurrent requests with some randomness
        for endpoint, _ in test_data['endpoints']:
            if random.random() < 0.3:  # 30% chance to change
                change = 1 if random.random() < 0.7 else -1  # 70% chance to increase
                test_data['concurrent_requests'][endpoint] = max(
                    1,
                    min(500, test_data['concurrent_requests'][endpoint] + change)
                )

        # Generate metrics for each endpoint
        for endpoint, pattern in test_data['endpoints']:
            concurrent = test_data['concurrent_requests'][endpoint]
            base_latency = pattern['base_latency']
            latency_factor = pattern['latency_factor']
            error_factor = pattern['error_factor']

            # Add some noise and load-based variations
            noise = random.uniform(-10, 10)
            load_factor = concurrent * latency_factor
            
            avg_response = base_latency + load_factor + noise
            min_response = max(1, avg_response * 0.5 + random.uniform(-5, 5))
            max_response = avg_response * 2 + random.uniform(0, 50)
            
            # Success rate decreases with load
            success_rate = max(80, min(100, 100 - (concurrent * error_factor) - random.uniform(0, 2)))

            metrics.append(EndpointMetrics(
                endpoint=endpoint,
                concurrent_requests=concurrent,
                avg_response_time=avg_response,
                min_response_time=min_response,
                max_response_time=max_response,
                success_rate=success_rate
            ))

        return metrics

class MetricsManager:
    def __init__(self):
        self.generator = MetricsGenerator()
        self.active_connections: Dict[str, List[WebSocket]] = {}

    def start_test(self, test_id: str, num_endpoints: Optional[int] = None):
        """Start a new test and initialize its connections list."""
        self.generator.start_test(test_id, num_endpoints)
        self.active_connections[test_id] = []

    def stop_test(self, test_id: str):
        """Stop a test and clean up its connections."""
        self.generator.stop_test(test_id)
        if test_id in self.active_connections:
            del self.active_connections[test_id]

    async def connect_client(self, test_id: str, websocket: WebSocket):
        """Connect a new client to a test's metrics stream."""
        await websocket.accept()
        if test_id not in self.active_connections:
            self.start_test(test_id)
        self.active_connections[test_id].append(websocket)

    async def disconnect_client(self, test_id: str, websocket: WebSocket):
        """Disconnect a client from a test's metrics stream."""
        if test_id in self.active_connections:
            self.active_connections[test_id].remove(websocket)
            if not self.active_connections[test_id]:
                self.stop_test(test_id)

    async def broadcast_metrics(self, test_id: str):
        """Broadcast metrics to all clients connected to a test."""
        if test_id not in self.active_connections:
            return

        metrics = self.generator.generate_metrics(test_id)
        if not metrics:
            return

        # Convert metrics to dict for JSON serialization
        metrics_data = [
            {
                "endpoint": m.endpoint,
                "concurrentRequests": m.concurrent_requests,
                "avgResponseTime": round(m.avg_response_time, 2),
                "minResponseTime": round(m.min_response_time, 2),
                "maxResponseTime": round(m.max_response_time, 2),
                "successRate": round(m.success_rate, 2)
            }
            for m in metrics
        ]

        # Send to all connected clients
        for websocket in self.active_connections[test_id][:]:  # Copy list to avoid modification during iteration
            try:
                await websocket.send_json(metrics_data)
            except:
                # If sending fails, remove the connection
                await self.disconnect_client(test_id, websocket)

# Global metrics manager instance
metrics_manager = MetricsManager()
