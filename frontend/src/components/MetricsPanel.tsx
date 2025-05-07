import { useEffect, useState } from 'react';
import { MetricsChart } from './MetricsChart';
import { TestSummary, DetailedEndpointMetric } from '../services/MetricsService';
import { fetchTestResults } from '../services/ApiService';

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load test results once
    async function loadTestResults() {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch test results from API
        const results = await fetchTestResults(testId);
        
        // Transform results into the format expected by the component
        const transformedSummary: TestSummary = {
          totalRequests: results.summary?.total_requests || 0,
          activeEndpoints: Object.keys(results.endpoints || {}),
          peakConcurrentRequests: Number(Object.keys(results.concurrency_levels || {}).pop() || 0),
          detailedMetrics: []
        };
        
        // Transform endpoint metrics for each concurrency level
        if (results.concurrency_levels) {
          const detailedMetrics: DetailedEndpointMetric[] = [];
          
          // Process each concurrency level
          Object.entries(results.concurrency_levels).forEach(([concurrencyLevel, levelData]) => {
            const concurrency = parseInt(concurrencyLevel);
            
            // Process each endpoint at this concurrency level
            if (levelData.endpoints) {
              Object.entries(levelData.endpoints).forEach(([endpoint, epData]) => {
                detailedMetrics.push({
                  endpoint,
                  concurrentRequests: concurrency,
                  successCount: epData.successful || 0,
                  failureCount: epData.failed || 0,
                  successRate: epData.successful / epData.requests,
                  responseTime: {
                    avg: epData.avg_response_time || 0,
                    min: epData.min_response_time || 0,
                    max: epData.max_response_time || 0
                  },
                  statusCodes: epData.status_codes || {},
                  timestamp: new Date().toISOString(),
                  errorMessage: null
                });
              });
            }
          });
          
          transformedSummary.detailedMetrics = detailedMetrics;
        }
        
        setSummary(transformedSummary);
        
        // Set selected endpoint to the first one if not already selected
        if (!selectedEndpoint && transformedSummary.activeEndpoints.length > 0) {
          setSelectedEndpoint(transformedSummary.activeEndpoints[0]);
        }
        
        setIsLoading(false);
        console.log('Test results loaded:', transformedSummary);
      } catch (error) {
        console.error('Error loading test results:', error);
        setError('Failed to load test results. Please try again.');
        setIsLoading(false);
      }
    }
    
    loadTestResults();
  }, [testId, selectedEndpoint]);

  const currentChart = chartTypes[currentChartIndex];
  
  // Get selected endpoint metrics
  const selectedEndpointMetrics = summary.detailedMetrics?.find(
    metric => metric.endpoint === selectedEndpoint
  );

  // Calculate overall success rate
  const overallSuccessRate = summary.detailedMetrics && summary.detailedMetrics.length > 0
    ? summary.detailedMetrics.reduce((acc, metric) => acc + (metric.successCount || 0), 0) / 
      summary.detailedMetrics.reduce((acc, metric) => acc + (metric.concurrentRequests || 0), 0) * 100 || 0
    : 0;

  // Calculate overall average response time
  const overallAvgResponseTime = summary.detailedMetrics && summary.detailedMetrics.length > 0
    ? summary.detailedMetrics.reduce((acc, metric) => acc + (metric.responseTime?.avg || 0), 0) / 
      summary.detailedMetrics.length || 0
    : 0;

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
          <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
        </div>
        <p className="mt-2 text-gray-600">Loading test results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="mb-4 text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-red-600 font-medium">{error}</p>
        <button 
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* High-level metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Requests</h3>
          <p className="mt-1 text-2xl font-semibold">{summary.totalRequests ? summary.totalRequests.toLocaleString() : 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Tested Endpoints</h3>
          <p className="mt-1 text-2xl font-semibold">{summary.activeEndpoints?.length || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Max Concurrent Requests</h3>
          <p className="mt-1 text-2xl font-semibold">{summary.peakConcurrentRequests || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Avg Success Rate</h3>
          <p className="mt-1 text-2xl font-semibold">{isNaN(overallSuccessRate) ? "0.0" : overallSuccessRate.toFixed(1)}%</p>
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
                {summary.activeEndpoints.map(endpoint => (
                  <option key={endpoint} value={endpoint}>
                    {endpoint}
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
                      style={{ width: `${(selectedEndpointMetrics.successRate || 0) * 100}%` }} 
                    ></div>
                    <div 
                      className="h-8 rounded-r bg-red-500" 
                      style={{ width: `${100 - (selectedEndpointMetrics.successRate || 0) * 100}%` }} 
                    ></div>
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-500">
                    <span>{selectedEndpointMetrics.successCount || 0} successful ({((selectedEndpointMetrics.successRate || 0) * 100).toFixed(1)}%)</span>
                    <span>{selectedEndpointMetrics.failureCount || 0} failed</span>
                  </div>
                </div>
                
                {/* Response Times */}
                <div className="bg-gray-50 rounded p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Response Times</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Average:</span>
                      <span className="text-xs font-medium">{(selectedEndpointMetrics.responseTime?.avg || 0).toFixed(2)} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Minimum:</span>
                      <span className="text-xs font-medium">{(selectedEndpointMetrics.responseTime?.min || 0).toFixed(2)} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Maximum:</span>
                      <span className="text-xs font-medium">{(selectedEndpointMetrics.responseTime?.max || 0).toFixed(2)} ms</span>
                    </div>
                  </div>
                </div>
                
                {/* Status Codes */}
                <div className="bg-gray-50 rounded p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Status Codes</h4>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {Object.entries(selectedEndpointMetrics.statusCodes || {}).map(([code, count]) => (
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
