import { useEffect, useState } from 'react';
import { DemoMetricsChart } from './DemoMetricsChart';
import { Button } from './Button';

const demoEndpoints = [
  '/api/users',
  '/api/products',
  '/api/orders',
  '/api/search',
  '/api/auth',
];

const endpointColors = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff8042',
  '#a4de6c',
];

const chartTypes = [
  {
    type: 'avgResponse',
    title: 'Average Response Time vs Concurrent Requests',
    label: 'Avg Response'
  },
  {
    type: 'successRate',
    title: 'Success Rate vs Concurrent Requests',
    label: 'Success Rate'
  },
  {
    type: 'minResponse',
    title: 'Minimum Response Time vs Concurrent Requests',
    label: 'Min Response'
  },
  {
    type: 'maxResponse',
    title: 'Maximum Response Time vs Concurrent Requests',
    label: 'Max Response'
  }
] as const;

export function DemoMetricsPanel() {
  const [totalRequests, setTotalRequests] = useState(0);
  const [peakConcurrent, setPeakConcurrent] = useState(500);
  const [currentChartIndex, setCurrentChartIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTotalRequests(prev => prev + Math.floor(Math.random() * 100) + 50);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const currentChart = chartTypes[currentChartIndex];

  return (
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Requests</h3>
          <p className="mt-1 text-2xl font-semibold">{totalRequests.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Active Endpoints</h3>
          <p className="mt-1 text-2xl font-semibold">{demoEndpoints.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Peak Concurrent Requests</h3>
          <p className="mt-1 text-2xl font-semibold">{peakConcurrent}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {chartTypes.map((chart, index) => (
              <button
                key={chart.type}
                onClick={() => setCurrentChartIndex(index)}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  index === currentChartIndex
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {chart.label}
              </button>
            ))}
          </nav>
        </div>
        <DemoMetricsChart 
          chartType={currentChart.type}
          title={currentChart.title}
          key={currentChart.type}
        />
      </div>

      <div className="text-sm text-gray-500 text-center">
        This is a demo visualization with simulated data. 
        The actual metrics will be based on real load test results.
      </div>
    </div>
  );
}
