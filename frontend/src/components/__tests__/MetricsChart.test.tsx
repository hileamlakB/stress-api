import { render, screen, act } from '@testing-library/react';
import { MetricsChart } from '../MetricsChart';
import { vi } from 'vitest';

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

// Mock Recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="chart-line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />
}));

describe('MetricsChart', () => {
  const defaultProps = {
    testId: 'test-123',
    chartType: 'avgResponse' as const,
    title: 'Average Response Time vs Concurrent Requests'
  };

  beforeEach(() => {
    // Setup WebSocket mock
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders chart with correct title and components', () => {
    render(<MetricsChart {...defaultProps} />);
    
    expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('establishes WebSocket connection with correct URL', () => {
    render(<MetricsChart {...defaultProps} />);
    
    expect(vi.mocked(WebSocket)).toHaveBeenCalledWith(
      `ws://localhost:8000/ws/metrics/${defaultProps.testId}`
    );
  });

  it('updates chart data when receiving WebSocket messages', async () => {
    const mockData = [
      {
        concurrentRequests: 10,
        avgResponseTime: 100,
        minResponseTime: 50,
        maxResponseTime: 200,
        successRate: 98,
        endpoint: '/api/test'
      }
    ];

    render(<MetricsChart {...defaultProps} />);
    
    const ws = vi.mocked(WebSocket).mock.instances[0] as unknown as MockWebSocket;
    
    await act(async () => {
      ws.simulateMessage(mockData);
    });

    // Verify chart lines are rendered
    const chartLines = screen.getAllByTestId('chart-line');
    expect(chartLines.length).toBeGreaterThan(0);
  });

  it('shows correct Y-axis label based on chart type', () => {
    // Test Average Response Time
    const { rerender } = render(<MetricsChart {...defaultProps} />);
    expect(screen.getByText('Response Time (ms)')).toBeInTheDocument();

    // Test Success Rate
    rerender(<MetricsChart {...defaultProps} chartType="successRate" title="Success Rate" />);
    expect(screen.getByText('Success Rate (%)')).toBeInTheDocument();
  });

  it('handles WebSocket disconnection gracefully', async () => {
    render(<MetricsChart {...defaultProps} />);
    
    const ws = vi.mocked(WebSocket).mock.instances[0] as unknown as MockWebSocket;
    
    await act(async () => {
      ws.simulateClose();
    });

    // Should show simulated data while disconnected
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('cleans up WebSocket connection on unmount', () => {
    const { unmount } = render(<MetricsChart {...defaultProps} />);
    
    const ws = vi.mocked(WebSocket).mock.instances[0] as unknown as MockWebSocket;
    
    unmount();
    
    expect(ws.close).toHaveBeenCalled();
  });
});
