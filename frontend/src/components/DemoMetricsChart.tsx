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

interface DemoMetricsChartProps {
  className?: string;
  chartType: 'avgResponse' | 'successRate' | 'minResponse' | 'maxResponse';
  title: string;
}

interface DemoEndpointMetric {
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
];

const demoEndpoints = [
  '/api/users',
  '/api/products',
  '/api/orders',
  '/api/search',
  '/api/auth',
];

const concurrentRequests = [1, 5, 10, 20, 50, 100, 200, 500];

function generateMetricPoint(endpoint: string, concurrent: number): DemoEndpointMetric {
  // Base values that increase with concurrent requests
  const baseAvg = 50 + (concurrent * 0.5);
  const baseMin = 20 + (concurrent * 0.2);
  const baseMax = 100 + (concurrent * 2);
  
  // Add some randomness and endpoint-specific patterns
  const multiplier = endpoint.includes('search') ? 1.5 : 
                    endpoint.includes('auth') ? 0.8 : 
                    1.0;

  return {
    concurrentRequests: concurrent,
    avgResponseTime: baseAvg * multiplier + (Math.random() * 20),
    minResponseTime: baseMin * multiplier + (Math.random() * 5),
    maxResponseTime: baseMax * multiplier + (Math.random() * 50),
    successRate: Math.max(80, Math.min(100, 100 - (concurrent * 0.02 * multiplier) - (Math.random() * 2))),
    endpoint
  };
}

function generateDemoData(): DemoEndpointMetric[] {
  const data: DemoEndpointMetric[] = [];
  concurrentRequests.forEach(concurrent => {
    demoEndpoints.forEach(endpoint => {
      data.push(generateMetricPoint(endpoint, concurrent));
    });
  });
  return data;
}

export function DemoMetricsChart({ className, chartType, title }: DemoMetricsChartProps) {
  const [metrics, setMetrics] = useState<DemoEndpointMetric[]>(generateDemoData());

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(generateDemoData());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
            {demoEndpoints.map((endpoint, index) => (
              <Line
                key={endpoint}
                type="monotone"
                data={metrics.filter(m => m.endpoint === endpoint)}
                dataKey={getDataKey()}
                name={endpoint}
                stroke={endpointColors[index]}
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
