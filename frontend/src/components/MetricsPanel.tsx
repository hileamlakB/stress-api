import { useEffect, useState } from 'react';
import { MetricsChart } from './MetricsChart';
import { MetricsService, TestSummary, DetailedEndpointMetric } from '../services/MetricsService';

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

interface MetricsPanelProps {
  testId: string;
}

export function MetricsPanel({ testId }: MetricsPanelProps) {
  const [currentChartIndex, setCurrentChartIndex] = useState(0);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [summary, setSummary] = useState<TestSummary>({
    totalRequests: 0,
    activeEndpoints: [],
    peakConcurrentRequests: 0
  });

  useEffect(() => {
    const metricsService = MetricsService.getInstance();
    
    // Start monitoring this test
    metricsService.startMonitoring(testId);
    
    // Subscribe to summary updates
    const handleSummaryUpdate = (newSummary: TestSummary) => {
      setSummary(newSummary);
      
      // Log detailed metrics to console
      console.log('Detailed Test Metrics:', JSON.stringify(newSummary, null, 2));
      
      // Set selected endpoint to the first one if not already selected
      if (!selectedEndpoint && newSummary.detailedMetrics && newSummary.detailedMetrics.length > 0) {
        setSelectedEndpoint(newSummary.detailedMetrics[0].endpoint);
      }
    };
    
    metricsService.subscribeToSummary(testId, handleSummaryUpdate);
    
    return () => {
      metricsService.unsubscribeFromSummary(testId, handleSummaryUpdate);
      metricsService.stopMonitoring();
    };
  }, [testId, selectedEndpoint]);

  const currentChart = chartTypes[currentChartIndex];
  
  // Get selected endpoint metrics
  const selectedEndpointMetrics = summary.detailedMetrics?.find(
    metric => metric.endpoint === selectedEndpoint
  );

  // Calculate overall success rate
  const overallSuccessRate = summary.detailedMetrics && summary.detailedMetrics.length > 0
    ? summary.detailedMetrics.reduce((acc, metric) => acc + metric.successCount, 0) / 
      summary.detailedMetrics.reduce((acc, metric) => acc + metric.concurrentRequests, 0) * 100
    : 0;

  // Calculate overall average response time
  const overallAvgResponseTime = summary.detailedMetrics && summary.detailedMetrics.length > 0
    ? summary.detailedMetrics.reduce((acc, metric) => acc + metric.responseTime.avg, 0) / 
      summary.detailedMetrics.length
    : 0;

  return (
    <div className="space-y-6 p-4">
      {/* High-level metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Requests</h3>
          <p className="mt-1 text-2xl font-semibold">{summary.totalRequests.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Active Endpoints</h3>
          <p className="mt-1 text-2xl font-semibold">{summary.activeEndpoints.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Peak Concurrent Requests</h3>
          <p className="mt-1 text-2xl font-semibold">{summary.peakConcurrentRequests}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Success Rate</h3>
          <p className="mt-1 text-2xl font-semibold">{overallSuccessRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* More detailed metrics */}
      {summary.detailedMetrics && summary.detailedMetrics.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 p-4">
            <h3 className="text-lg font-medium">Endpoint Performance</h3>
            <div className="mt-2">
              <select 
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={selectedEndpoint || ''}
                onChange={(e) => setSelectedEndpoint(e.target.value)}
              >
                {summary.detailedMetrics.map(metric => (
                  <option key={metric.endpoint} value={metric.endpoint}>
                    {metric.endpoint}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {selectedEndpointMetrics && (
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {/* Success/Failure */}
                <div className="bg-gray-50 rounded p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Success / Failure</h4>
                  <div className="flex items-end">
                    <div 
                      className="h-8 rounded-l bg-green-500" 
                      style={{ width: `${selectedEndpointMetrics.successRate * 100}%` }} 
                    ></div>
                    <div 
                      className="h-8 rounded-r bg-red-500" 
                      style={{ width: `${100 - selectedEndpointMetrics.successRate * 100}%` }} 
                    ></div>
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-500">
                    <span>{selectedEndpointMetrics.successCount} successful ({(selectedEndpointMetrics.successRate * 100).toFixed(1)}%)</span>
                    <span>{selectedEndpointMetrics.failureCount} failed</span>
                  </div>
                </div>
                
                {/* Response Times */}
                <div className="bg-gray-50 rounded p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Response Times</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Average:</span>
                      <span className="text-xs font-medium">{selectedEndpointMetrics.responseTime.avg.toFixed(2)} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Minimum:</span>
                      <span className="text-xs font-medium">{selectedEndpointMetrics.responseTime.min.toFixed(2)} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Maximum:</span>
                      <span className="text-xs font-medium">{selectedEndpointMetrics.responseTime.max.toFixed(2)} ms</span>
                    </div>
                  </div>
                </div>
                
                {/* Status Codes */}
                <div className="bg-gray-50 rounded p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Status Codes</h4>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {Object.entries(selectedEndpointMetrics.statusCodes).map(([code, count]) => (
                      <div key={code} className="flex justify-between">
                        <span className={`text-xs ${parseInt(code) < 400 ? 'text-green-600' : 'text-red-600'}`}>
                          {code}:
                        </span>
                        <span className="text-xs font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {selectedEndpointMetrics.errorMessage && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded p-3 text-sm">
                  <span className="font-medium">Error:</span> {selectedEndpointMetrics.errorMessage}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Charts */}
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
        <MetricsChart 
          testId={testId}
          chartType={currentChart.type}
          title={currentChart.title}
          key={currentChart.type}
          detailedMetrics={summary.detailedMetrics}
        />
      </div>
    </div>
  );
}
