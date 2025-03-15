import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { cn } from '../lib/utils';
import { MetricsService, EndpointMetric } from '../services/MetricsService';

interface MetricsChartProps {
  className?: string;
  testId: string;
  chartType: 'avgResponse' | 'successRate' | 'minResponse' | 'maxResponse';
  title: string;
}

interface EndpointMetric {
  concurrentRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
  endpoint: string;
}

const endpointColors = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff8042',
  '#a4de6c',
  '#d0ed57',
  '#83a6ed',
  '#8dd1e1',
];

const concurrentRequests = [1, 5, 10, 20, 50, 100, 200, 500];

// Simulate metrics until WebSocket is connected
function generateSimulatedMetric(endpoint: string, concurrent: number): EndpointMetric {
  return {
    concurrentRequests: concurrent,
    avgResponseTime: 50 + concurrent * 0.5 + Math.random() * 20,
    minResponseTime: 20 + concurrent * 0.2 + Math.random() * 5,
    maxResponseTime: 100 + concurrent * 2 + Math.random() * 50,
    successRate: Math.max(80, Math.min(100, 100 - (concurrent * 0.02) - Math.random() * 2)),
    endpoint
  };
}

function generateSimulatedData(endpoints: string[]): EndpointMetric[] {
  const data: EndpointMetric[] = [];
  concurrentRequests.forEach(concurrent => {
    endpoints.forEach(endpoint => {
      data.push(generateSimulatedMetric(endpoint, concurrent));
    });
  });
  return data;
}

export function MetricsChart({ className, testId, chartType, title }: MetricsChartProps) {
  const [metrics, setMetrics] = useState<EndpointMetric[]>([]);
  const [endpoints, setEndpoints] = useState<string[]>(['/api/test1', '/api/test2', '/api/test3']);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Start with simulated data
    setMetrics(generateSimulatedData(endpoints));
    
    const ws = new WebSocket(`ws://localhost:8000/ws/metrics/${testId}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const newMetrics = JSON.parse(event.data);
      setMetrics(newMetrics);
      
      // Update unique endpoints
      const uniqueEndpoints = Array.from(new Set(newMetrics.map((m: EndpointMetric) => m.endpoint)));
      setEndpoints(uniqueEndpoints);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    // If not connected, update simulated data periodically
    const interval = setInterval(() => {
      if (!isConnected) {
        setMetrics(generateSimulatedData(endpoints));
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      ws.close();
export function MetricsChart({ className, testId, chartType, title }: MetricsChartProps) {
  const [metrics, setMetrics] = useState<EndpointMetric[]>([]);
  const [endpoints, setEndpoints] = useState<string[]>([]);

  useEffect(() => {
    const metricsService = MetricsService.getInstance();
    
    const handleMetricsUpdate = (newMetrics: EndpointMetric[]) => {
      setMetrics(newMetrics);
      setEndpoints(Array.from(new Set(newMetrics.map(m => m.endpoint))));
    };
    
    metricsService.subscribeToMetrics(testId, handleMetricsUpdate);
    
    return () => {
      metricsService.unsubscribeFromMetrics(testId, handleMetricsUpdate);
    };
  }, [testId]);

  const getYAxisLabel = () => {
    switch (chartType) {
      case 'avgResponse':
      case 'minResponse':
      case 'maxResponse':
        return 'Response Time (ms)';
      case 'successRate':
        return 'Success Rate (%)';
      default:
        return '';
    }
  };

  const getDataKey = () => {
    switch (chartType) {
      case 'avgResponse':
        return 'avgResponseTime';
      case 'minResponse':
        return 'minResponseTime';
      case 'maxResponse':
        return 'maxResponseTime';
      case 'successRate':
        return 'successRate';
      default:
        return '';
    }
  };

  return (
    <div className={cn("w-full h-[400px]", className)}>
      <h3 className="text-lg font-semibold mb-2 px-4">{title}</h3>
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="concurrentRequests"
              type="number"
              domain={[0, 500]}
              label={{ value: 'Concurrent Requests', position: 'bottom' }}
            />
            <YAxis
              domain={chartType === 'successRate' ? [80, 100] : ['auto', 'auto']}
              label={{ 
                value: getYAxisLabel(), 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle' }
              }}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(2)} ${chartType === 'successRate' ? '%' : 'ms'}`, '']}
              labelFormatter={(value) => `Concurrent Requests: ${value}`}
            />
            <Legend 
              layout="vertical" 
              verticalAlign="middle" 
              align="right"
              wrapperStyle={{ paddingLeft: '10px' }}
            />
            {endpoints.map((endpoint, index) => (
              <Line
                key={endpoint}
                type="monotone"
                data={metrics.filter(m => m.endpoint === endpoint)}
                dataKey={getDataKey()}
                name={endpoint}
                stroke={endpointColors[index % endpointColors.length]}
                dot={true}
                activeDot={{ r: 6 }}
                animationDuration={300}
                isAnimationActive={true}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
