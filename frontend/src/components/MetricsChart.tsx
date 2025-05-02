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
import { useTheme } from '../contexts/ThemeContext';

interface MetricsChartProps {
  className?: string;
  testId: string;
  chartType: 'avgResponse' | 'successRate' | 'minResponse' | 'maxResponse';
  title: string;
  detailedMetrics?: DetailedEndpointMetric[];
}

const endpointColors = {
  light: [
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#ff8042',
    '#a4de6c',
    '#d0ed57',
    '#83a6ed',
    '#8dd1e1',
  ],
  dark: [
    '#b4b2ff',
    '#90edb5',
    '#ffd470',
    '#ff9b66',
    '#beff7d',
    '#e5ff6a',
    '#99c4ff',
    '#a3f0ff',
  ]
};

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
  const { isDarkMode } = useTheme();

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
        <p className="text-gray-400 dark:text-gray-500">No data available for chart</p>
      </div>
    );
  }

  const chartColors = isDarkMode ? endpointColors.dark : endpointColors.light;

  return (
    <div className={cn("w-full h-[400px]", className)}>
      <h3 className="text-lg font-semibold mb-2 px-4">{title}</h3>
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={isDarkMode ? '#374151' : '#e5e7eb'}
            />
            <XAxis 
              dataKey="concurrentRequests" 
              stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
              label={{ 
                value: 'Concurrent Requests',
                position: 'insideBottom',
                offset: -5,
                fill: isDarkMode ? '#9CA3AF' : '#6B7280'
              }}
            />
            <YAxis 
              stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
              label={{ 
                value: getYAxisLabel(),
                angle: -90,
                position: 'insideLeft',
                fill: isDarkMode ? '#9CA3AF' : '#6B7280'
              }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
                border: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`,
                color: isDarkMode ? '#F3F4F6' : '#111827'
              }}
            />
            <Legend 
              wrapperStyle={{
                color: isDarkMode ? '#F3F4F6' : '#111827'
              }}
            />
            {endpoints.map((endpoint, index) => (
              <Line
                key={endpoint}
                type="monotone"
                dataKey={getDataKey()}
                data={chartData.filter(d => d.endpoint === endpoint)}
                name={endpoint}
                stroke={chartColors[index % chartColors.length]}
                strokeWidth={2}
                dot={{
                  fill: chartColors[index % chartColors.length],
                  stroke: isDarkMode ? '#1F2937' : '#FFFFFF',
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: chartColors[index % chartColors.length],
                  stroke: isDarkMode ? '#1F2937' : '#FFFFFF',
                  strokeWidth: 2,
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
