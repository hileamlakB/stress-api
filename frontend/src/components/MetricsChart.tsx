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
import { MetricsService, DetailedEndpointMetric } from '../services/MetricsService';

interface MetricsChartProps {
  className?: string;
  testId: string;
  chartType: 'avgResponse' | 'successRate' | 'minResponse' | 'maxResponse';
  title: string;
  detailedMetrics?: DetailedEndpointMetric[];
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

// Transform detailed metrics into chart-friendly format
function transformMetricsForChart(metrics: DetailedEndpointMetric[]): any[] {
  if (!metrics || metrics.length === 0) return [];
  
  return metrics.map(metric => ({
    endpoint: metric.endpoint,
    concurrentRequests: metric.concurrentRequests,
    avgResponseTime: metric.responseTime.avg,
    minResponseTime: metric.responseTime.min,
    maxResponseTime: metric.responseTime.max,
    successRate: metric.successRate * 100, // Convert to percentage
  }));
}

export function MetricsChart({ className, testId, chartType, title, detailedMetrics = [] }: MetricsChartProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [endpoints, setEndpoints] = useState<string[]>([]);

  useEffect(() => {
    // Transform detailed metrics for chart display
    if (detailedMetrics && detailedMetrics.length > 0) {
      const transformedData = transformMetricsForChart(detailedMetrics);
      setChartData(transformedData);
      setEndpoints(Array.from(new Set(transformedData.map(m => m.endpoint))));
    } else {
      // Use empty data when no metrics are available
      setChartData([]);
      setEndpoints([]);
    }
  }, [detailedMetrics]);

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

  // If no data, show empty state
  if (chartData.length === 0) {
    return (
      <div className={cn("w-full h-[400px] flex items-center justify-center", className)}>
        <p className="text-gray-400">No data available for chart</p>
      </div>
    );
  }

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
                data={chartData.filter(m => m.endpoint === endpoint)}
                dataKey={getDataKey()}
                name={endpoint}
                stroke={endpointColors[index % endpointColors.length]}
                dot={true}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
