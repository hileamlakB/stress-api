import pytest
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket
import asyncio
from typing import List, Dict, Any
import json

from metrics_generator import MetricsGenerator, MetricsManager, EndpointMetrics
from main import app

class MockWebSocket:
    def __init__(self):
        self.sent_messages: List[Dict[str, Any]] = []
        self.closed = False

    async def accept(self):
        pass

    async def send_json(self, data: Dict[str, Any]):
        self.sent_messages.append(data)

    async def close(self):
        self.closed = True

def test_metrics_generator_initialization():
    generator = MetricsGenerator()
    assert len(generator.endpoint_patterns) == 5
    assert generator.active_tests == {}

def test_start_stop_test():
    generator = MetricsGenerator()
    test_id = "test-123"
    
    # Start test
    generator.start_test(test_id, num_endpoints=3)
    assert test_id in generator.active_tests
    assert len(generator.active_tests[test_id]['endpoints']) == 3
    
    # Stop test
    generator.stop_test(test_id)
    assert test_id not in generator.active_tests

def test_generate_metrics():
    generator = MetricsGenerator()
    test_id = "test-123"
    generator.start_test(test_id, num_endpoints=2)
    
    metrics = generator.generate_metrics(test_id)
    assert len(metrics) == 2
    
    for metric in metrics:
        assert isinstance(metric, EndpointMetrics)
        assert metric.concurrent_requests >= 1
        assert metric.avg_response_time > 0
        assert metric.min_response_time > 0
        assert metric.max_response_time > 0
        assert 80 <= metric.success_rate <= 100

def test_metrics_ranges():
    generator = MetricsGenerator()
    test_id = "test-123"
    generator.start_test(test_id, num_endpoints=1)
    
    # Generate multiple sets of metrics to check ranges
    all_metrics = [generator.generate_metrics(test_id) for _ in range(10)]
    
    for metrics in all_metrics:
        for metric in metrics:
            assert 1 <= metric.concurrent_requests <= 500
            assert metric.min_response_time <= metric.avg_response_time <= metric.max_response_time
            assert 80 <= metric.success_rate <= 100

@pytest.mark.asyncio
async def test_metrics_manager():
    manager = MetricsManager()
    test_id = "test-123"
    websocket = MockWebSocket()
    
    # Test connection
    await manager.connect_client(test_id, websocket)
    assert test_id in manager.active_connections
    assert websocket in manager.active_connections[test_id]
    
    # Test broadcasting
    await manager.broadcast_metrics(test_id)
    assert len(websocket.sent_messages) > 0
    
    metrics_data = websocket.sent_messages[0]
    assert isinstance(metrics_data, list)
    for metric in metrics_data:
        assert "endpoint" in metric
        assert "concurrentRequests" in metric
        assert "avgResponseTime" in metric
        assert "minResponseTime" in metric
        assert "maxResponseTime" in metric
        assert "successRate" in metric
    
    # Test disconnection
    await manager.disconnect_client(test_id, websocket)
    assert test_id not in manager.active_connections
    assert websocket.closed

@pytest.mark.asyncio
async def test_multiple_clients():
    manager = MetricsManager()
    test_id = "test-123"
    websocket1 = MockWebSocket()
    websocket2 = MockWebSocket()
    
    # Connect multiple clients
    await manager.connect_client(test_id, websocket1)
    await manager.connect_client(test_id, websocket2)
    assert len(manager.active_connections[test_id]) == 2
    
    # Broadcast to multiple clients
    await manager.broadcast_metrics(test_id)
    assert len(websocket1.sent_messages) == len(websocket2.sent_messages)
    assert websocket1.sent_messages[0] == websocket2.sent_messages[0]

def test_endpoint_characteristics():
    generator = MetricsGenerator()
    test_id = "test-123"
    generator.start_test(test_id, num_endpoints=len(generator.endpoint_patterns))
    
    metrics = generator.generate_metrics(test_id)
    
    # Check that different endpoints have different characteristics
    response_times = [m.avg_response_time for m in metrics]
    assert len(set(response_times)) == len(response_times)  # All should be different

@pytest.mark.asyncio
async def test_websocket_endpoint():
    client = TestClient(app)
    test_id = "test-123"
    
    # Test the summary endpoint
    response = client.get(f"/api/tests/{test_id}/summary")
    assert response.status_code == 200
    summary = response.json()
    assert "totalRequests" in summary
    assert "activeEndpoints" in summary
    assert "peakConcurrentRequests" in summary
