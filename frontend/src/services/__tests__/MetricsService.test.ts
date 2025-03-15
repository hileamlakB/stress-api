import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetricsService } from '../MetricsService';

// Mock WebSocket
class MockWebSocket {
  onmessage: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  onopen: (() => void) | null = null;
  close = vi.fn();
  send = vi.fn();

  constructor(public url: string) {
    setTimeout(() => this.onopen?.(), 0);
  }

  // Helper to simulate receiving messages
  simulateMessage(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  // Helper to simulate connection close
  simulateClose() {
    this.onclose?.();
  }
}

// Mock fetch
const mockFetch = vi.fn();

describe('MetricsService', () => {
  let service: MetricsService;
  const testId = 'test-123';

  beforeEach(() => {
    // Setup WebSocket mock
    vi.stubGlobal('WebSocket', MockWebSocket);
    
    // Setup fetch mock
    global.fetch = mockFetch;
    
    // Reset service instance
    // @ts-ignore - accessing private property for testing
    MetricsService.instance = null;
    service = MetricsService.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    service.stopMonitoring();
  });

  it('maintains singleton instance', () => {
    const instance1 = MetricsService.getInstance();
    const instance2 = MetricsService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('establishes WebSocket connection with correct URL', () => {
    service.startMonitoring(testId);
    expect(vi.mocked(WebSocket)).toHaveBeenCalledWith(
      `ws://localhost:8000/ws/metrics/${testId}`
    );
  });

  it('notifies metrics listeners of new data', async () => {
    const listener = vi.fn();
    const testMetrics = [
      {
        endpoint: '/api/test',
        concurrentRequests: 10,
        avgResponseTime: 100,
        minResponseTime: 50,
        maxResponseTime: 200,
        successRate: 98
      }
    ];

    service.subscribeToMetrics(testId, listener);
    service.startMonitoring(testId);

    const ws = vi.mocked(WebSocket).mock.instances[0] as unknown as MockWebSocket;
    ws.simulateMessage(testMetrics);

    expect(listener).toHaveBeenCalledWith(testMetrics);
  });

  it('handles multiple metric subscribers', async () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const testMetrics = [
      {
        endpoint: '/api/test',
        concurrentRequests: 10,
        avgResponseTime: 100,
        minResponseTime: 50,
        maxResponseTime: 200,
        successRate: 98
      }
    ];

    service.subscribeToMetrics(testId, listener1);
    service.subscribeToMetrics(testId, listener2);
    service.startMonitoring(testId);

    const ws = vi.mocked(WebSocket).mock.instances[0] as unknown as MockWebSocket;
    ws.simulateMessage(testMetrics);

    expect(listener1).toHaveBeenCalledWith(testMetrics);
    expect(listener2).toHaveBeenCalledWith(testMetrics);
  });

  it('removes metrics subscribers correctly', async () => {
    const listener = vi.fn();
    const testMetrics = [
      {
        endpoint: '/api/test',
        concurrentRequests: 10,
        avgResponseTime: 100,
        minResponseTime: 50,
        maxResponseTime: 200,
        successRate: 98
      }
    ];

    service.subscribeToMetrics(testId, listener);
    service.startMonitoring(testId);

    const ws = vi.mocked(WebSocket).mock.instances[0] as unknown as MockWebSocket;
    ws.simulateMessage(testMetrics);
    expect(listener).toHaveBeenCalledTimes(1);

    service.unsubscribeFromMetrics(testId, listener);
    ws.simulateMessage(testMetrics);
    expect(listener).toHaveBeenCalledTimes(1); // Still only called once
  });

  it('fetches and notifies summary listeners', async () => {
    const listener = vi.fn();
    const testSummary = {
      totalRequests: 100,
      activeEndpoints: ['/api/test'],
      peakConcurrentRequests: 50
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(testSummary)
    });

    service.subscribeToSummary(testId, listener);
    service.startMonitoring(testId);

    // Wait for the first polling interval
    await new Promise(resolve => setTimeout(resolve, 1100));

    expect(mockFetch).toHaveBeenCalledWith(
      `http://localhost:8000/api/tests/${testId}/summary`
    );
    expect(listener).toHaveBeenCalledWith(testSummary);
  });

  it('handles WebSocket reconnection on close', async () => {
    service.startMonitoring(testId);
    
    const ws = vi.mocked(WebSocket).mock.instances[0] as unknown as MockWebSocket;
    ws.simulateClose();

    // Wait for reconnection attempt
    await new Promise(resolve => setTimeout(resolve, 1100));

    expect(vi.mocked(WebSocket)).toHaveBeenCalledTimes(2);
  });

  it('cleans up resources on stop monitoring', () => {
    service.startMonitoring(testId);
    
    const ws = vi.mocked(WebSocket).mock.instances[0] as unknown as MockWebSocket;
    service.stopMonitoring();

    expect(ws.close).toHaveBeenCalled();
  });
});
