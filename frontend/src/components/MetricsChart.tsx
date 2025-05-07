import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { cn } from '../lib/utils';
import { MetricsService, DetailedEndpointMetric } from '../services/MetricsService';

interface MetricsChartProps {
  className?: string;
  testId: string;
  chartType: 'avgResponse' | 'successRate' | 'minResponse' | 'maxResponse';
  title: string;
  detailedMetrics?: DetailedEndpointMetric[];
  preloadedResults?: any;
}

const endpointColors = [
  '#8884d8', // Purple
  '#82ca9d', // Green
  '#ffc658', // Yellow
  '#ff8042', // Orange
  '#a4de6c', // Light Green
  '#d0ed57', // Lime
  '#83a6ed', // Light Blue
  '#8dd1e1', // Cyan
];

// Transform detailed metrics into chart-friendly format
function transformMetricsForChart(metrics: DetailedEndpointMetric[]): any[] {
  if (!metrics || metrics.length === 0) return [];
  
  // Group by endpoint
  const endpointGroups: Record<string, DetailedEndpointMetric[]> = {};
  
  metrics.forEach(metric => {
    if (!endpointGroups[metric.endpoint]) {
      endpointGroups[metric.endpoint] = [];
    }
    endpointGroups[metric.endpoint].push({...metric});
  });
  
  // Sort each endpoint group by concurrency level
  Object.keys(endpointGroups).forEach(endpoint => {
    endpointGroups[endpoint].sort((a, b) => a.concurrentRequests - b.concurrentRequests);
  });
  
  // Flatten back to array for chart
  const result: any[] = [];
  Object.values(endpointGroups).forEach(endpointMetrics => {
    endpointMetrics.forEach(metric => {
      result.push({
        endpoint: metric.endpoint,
        concurrentRequests: metric.concurrentRequests,
        avgResponseTime: metric.responseTime.avg,
        minResponseTime: metric.responseTime.min,
        maxResponseTime: metric.responseTime.max,
        successRate: metric.successRate * 100, // Convert to percentage
      });
    });
  });
  
  return result;
}

export function MetricsChart({ className, testId, chartType, title, detailedMetrics = [], preloadedResults }: MetricsChartProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [endpoints, setEndpoints] = useState<string[]>([]);
  const [concurrencyLevels, setConcurrencyLevels] = useState<number[]>([]);

  useEffect(() => {
    // Transform detailed metrics for chart display
    if (detailedMetrics && detailedMetrics.length > 0) {
      const transformedData = transformMetricsForChart(detailedMetrics);
      setChartData(transformedData);
      
      // Extract unique endpoints
      const uniqueEndpoints = Array.from(new Set(transformedData.map(m => m.endpoint)));
      setEndpoints(uniqueEndpoints);
      
      // Extract unique concurrency levels for grid lines
      const uniqueConLevels = Array.from(new Set(transformedData.map(m => m.concurrentRequests))).sort((a, b) => a - b);
      setConcurrencyLevels(uniqueConLevels);
    } else {
      // Use empty data when no metrics are available
      setChartData([]);
      setEndpoints([]);
      setConcurrencyLevels([]);
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
              domain={['dataMin', 'dataMax']}
              allowDecimals={false}
              ticks={concurrencyLevels}
            />
            <YAxis
              domain={chartType === 'successRate' ? [0, 100] : ['auto', 'auto']}
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
            
            {/* Add reference lines for each concurrency level */}
            {concurrencyLevels.map(level => (
              <ReferenceLine 
                key={`ref-${level}`} 
                x={level} 
                stroke="#ccc" 
                strokeDasharray="3 3" 
                label={{ value: `${level}`, position: 'bottom', fill: '#666', fontSize: 10 }} 
              />
            ))}
            
            {endpoints.map((endpoint, index) => {
              // Get data for this endpoint
              const endpointData = chartData.filter(m => m.endpoint === endpoint);
              // Sort by concurrency level to ensure proper line
              endpointData.sort((a, b) => a.concurrentRequests - b.concurrentRequests);
              
              return (
                <Line
                  key={endpoint}
                  type="monotone"
                  data={endpointData}
                  dataKey={getDataKey()}
                  name={endpoint}
                  stroke={endpointColors[index % endpointColors.length]}
                  strokeWidth={2}
                  dot={{ r: 5, strokeWidth: 1 }}
                  activeDot={{ r: 7, strokeWidth: 1 }}
                  connectNulls={true}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
