import { useEffect, useState } from 'react';
import { DemoMetricsPanel } from '../../DemoMetricsPanel';
import { useWizard } from '../WizardContext';
import apiService from '../../../services/ApiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type ResultData = {
  test_id: string;
  status: string;
  start_time: string;
  end_time: string;
  results: any[];
  summary: {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    avg_response_time: number;
    min_response_time: number;
    max_response_time: number;
    status_codes: Record<string, number>;
    concurrency_metrics?: {
      [endpoint: string]: {
        concurrency: number[];
        avg_response_time: number[];
        min_response_time: number[];
        max_response_time: number[];
        success_rate: number[];
        throughput: number[];
        total_requests: number[];
      }
    }
  }
};

// Define tab types
type MetricTab = 'avg_response_time' | 'min_response_time' | 'max_response_time' | 'success_rate' | 'throughput';

// Colors for different endpoints
const endpointColors = [
  '#8884d8', // purple
  '#82ca9d', // green
  '#ffc658', // yellow
  '#ff7300', // orange
  '#0088fe', // blue
  '#ff8042', // coral
  '#8dd1e1', // teal
  '#a4de6c', // lime
  '#d0ed57', // yellow-green
  '#83a6ed', // sky blue
];

export function ResultsStep() {
  const { activeTestId } = useWizard();
  const [testResults, setTestResults] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MetricTab>('avg_response_time');
  const [noDataFound, setNoDataFound] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    // Reset states when test ID changes
    if (activeTestId) {
      setLoading(true);
      setError(null);
      setNoDataFound(false);
    }
  }, [activeTestId]);

  useEffect(() => {
    let isSubscribed = true;
    let retryTimeout: NodeJS.Timeout;

    async function fetchTestResults() {
      if (!activeTestId) return;
      
      try {
        const results = await apiService.getTestResults(activeTestId);
        
        if (!isSubscribed) return;
        
        console.log('Test results fetched successfully:', activeTestId);
        
        // Check if we have any meaningful data
        const hasData = results && 
          results.summary && 
          results.summary.concurrency_metrics && 
          Object.keys(results.summary.concurrency_metrics).length > 0;
        
        if (hasData) {
          setTestResults(results);
          setNoDataFound(false);
          setLoading(false);
        } else {
          // If no data but test is still running, we'll retry
          if (results.status === 'running' || results.status === 'pending') {
            setNoDataFound(true);
            setLoading(false);
            
            // Schedule a retry if test is still running
            if (retryCount < 10) { // Limit retries
              retryTimeout = setTimeout(() => {
                if (isSubscribed) {
                  setRetryCount(count => count + 1);
                  setLoading(true);
                }
              }, 3000); // Retry after 3 seconds
            }
          } else {
            // Test completed but no data
            setTestResults(results);
            setNoDataFound(true);
            setLoading(false);
          }
        }
      } catch (err: any) {
        if (!isSubscribed) return;
        
        console.error('Error fetching test results:', err);
        
        // Handle 404 (test not found) separately
        if (err.message && err.message.includes('404')) {
          setError('Test not found. The test ID may be invalid or the test has been deleted.');
        } else {
          setError(`Failed to load test results: ${err.message || 'Unknown error'}`);
        }
        
        setLoading(false);
      }
    }
    
    if (activeTestId && (loading || retryCount > 0)) {
      fetchTestResults();
    }
    
    // Cleanup function
    return () => {
      isSubscribed = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [activeTestId, loading, retryCount]);
  
  // Prepare data for the currently selected metric
  const prepareChartData = () => {
    if (!testResults?.summary?.concurrency_metrics) return [];
    
    const concurrencyMetrics = testResults.summary.concurrency_metrics;
    const endpoints = Object.keys(concurrencyMetrics);
    
    // If no endpoints or no data, return empty array
    if (endpoints.length === 0) return [];
    
    // Extract all concurrency levels across endpoints
    const allConcurrencyLevels = new Set<number>();
    endpoints.forEach(endpoint => {
      concurrencyMetrics[endpoint].concurrency.forEach(level => allConcurrencyLevels.add(level));
    });
    
    // If no concurrency levels, return empty array
    if (allConcurrencyLevels.size === 0) return [];
    
    // Sort concurrency levels
    const sortedConcurrencyLevels = Array.from(allConcurrencyLevels).sort((a, b) => a - b);
    
    // Create data points for each concurrency level
    return sortedConcurrencyLevels.map(concurrency => {
      const dataPoint: Record<string, any> = { concurrency };
      
      endpoints.forEach(endpoint => {
        const metrics = concurrencyMetrics[endpoint];
        const concurrencyIndex = metrics.concurrency.indexOf(concurrency);
        
        if (concurrencyIndex !== -1) {
          // Use safe endpoint name for data key (replace slashes and special chars)
          const safeEndpointName = endpoint.replace(/[^a-zA-Z0-9]/g, '_');
          
          dataPoint[`${safeEndpointName}_${activeTab}`] = metrics[activeTab as keyof typeof metrics][concurrencyIndex];
          dataPoint[`${safeEndpointName}_name`] = endpoint; // Store original endpoint name for tooltip
        }
      });
      
      return dataPoint;
    });
  };
  
  // Get metric unit for formatting
  const getMetricUnit = (metric: MetricTab): string => {
    switch (metric) {
      case 'avg_response_time':
      case 'min_response_time':
      case 'max_response_time':
        return 'ms';
      case 'success_rate':
        return '%';
      case 'throughput':
        return 'req/s';
      default:
        return '';
    }
  };
  
  // Format metric value for display
  const formatMetricValue = (value: any, metric: MetricTab): string => {
    if (typeof value !== 'number') return 'N/A';
    
    switch (metric) {
      case 'avg_response_time':
      case 'min_response_time':
      case 'max_response_time':
        return `${value.toFixed(2)} ms`;
      case 'success_rate':
        return `${value.toFixed(2)}%`;
      case 'throughput':
        return `${value.toFixed(2)} req/s`;
      default:
        return value.toString();
    }
  };
  
  // Get user-friendly tab name
  const getTabName = (tab: MetricTab): string => {
    switch (tab) {
      case 'avg_response_time':
        return 'Avg Response Time';
      case 'min_response_time':
        return 'Min Response Time';
      case 'max_response_time':
        return 'Max Response Time';
      case 'success_rate':
        return 'Success Rate';
      case 'throughput':
        return 'Throughput';
      default:
        return tab;
    }
  };
  
  // Get Y-axis domain for the current metric
  const getYAxisDomain = (metric: MetricTab): [number, number] | undefined => {
    switch (metric) {
      case 'success_rate':
        return [0, 100]; // 0-100%
      default:
        return undefined; // Auto-scale
    }
  };
  
  // Get Y-axis label
  const getYAxisLabel = (metric: MetricTab): string => {
    switch (metric) {
      case 'avg_response_time':
        return 'Avg Response Time (ms)';
      case 'min_response_time':
        return 'Min Response Time (ms)';
      case 'max_response_time':
        return 'Max Response Time (ms)';
      case 'success_rate':
        return 'Success Rate (%)';
      case 'throughput':
        return 'Throughput (req/s)';
      default:
        return 'Value';
    }
  };
  
  // Handle retry button click
  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setNoDataFound(false);
    setRetryCount(0);
  };
  
  // States for different situations
  const isEmptyState = !activeTestId;
  const hasData = testResults && testResults.summary && testResults.summary.total_requests > 0;
  const chartData = prepareChartData();
  const hasChartData = chartData.length > 0;
  const shouldShowNoDataMessage = noDataFound || (testResults && !hasData && !loading);
  
  // Render different states
  const renderEmptyState = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Example Visualization</h2>
        <p className="text-sm text-gray-500">This is how your metrics will look after a stress test completes</p>
      </div>
      <DemoMetricsPanel />
    </div>
  );
  
  const renderLoadingState = () => (
    <div className="bg-white rounded-lg shadow p-8">
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">Loading test results...</p>
      </div>
    </div>
  );
  
  const renderErrorState = () => (
    <div className="bg-white rounded-lg shadow p-8">
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-red-600 font-medium text-center mb-4">{error}</p>
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          onClick={handleRetry}
        >
          Retry
        </button>
      </div>
    </div>
  );
  
  const renderNoDataState = () => (
    <div className="bg-white rounded-lg shadow p-8">
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-yellow-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-600 font-medium text-center mb-2">No test data available yet</p>
        <p className="text-gray-500 text-sm text-center mb-4">
          {testResults?.status === 'running' 
            ? 'The test is still running. Data will appear as it becomes available.'
            : 'The test has completed but no data was collected.'}
        </p>
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          onClick={handleRetry}
        >
          Refresh
        </button>
      </div>
    </div>
  );
  
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              {activeTestId 
                ? 'Test results are displayed below. Each tab shows a different performance metric across concurrency levels.'
                : 'No test data available. Run a stress test to see performance metrics.'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Render appropriate UI based on state */}
      {isEmptyState && renderEmptyState()}
      {loading && renderLoadingState()}
      {error && renderErrorState()}
      {shouldShowNoDataMessage && renderNoDataState()}
      
      {/* Render results when we have data */}
      {activeTestId && hasData && !loading && !error && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Stress Test Results</h2>
            <p className="text-sm text-gray-500">Test ID: {activeTestId}</p>
            
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <h3 className="text-sm font-medium">Total Requests</h3>
                <p className="text-2xl font-bold">{testResults?.summary.total_requests.toLocaleString()}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <h3 className="text-sm font-medium">Success Rate</h3>
                <p className="text-2xl font-bold">
                  {testResults && testResults.summary.total_requests > 0 
                    ? (testResults.summary.successful_requests / testResults.summary.total_requests * 100).toFixed(2)
                    : "0.00"}%
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <h3 className="text-sm font-medium">Avg Response Time</h3>
                <p className="text-2xl font-bold">{testResults?.summary.avg_response_time.toFixed(2)} ms</p>
              </div>
            </div>
          </div>
          
          {testResults?.summary.concurrency_metrics && hasChartData && (
            <div className="p-6">
              <h3 className="text-md font-semibold mb-4">Performance by Concurrency Level</h3>
              
              {/* Tabs for different metrics */}
              <div className="flex border-b border-gray-200 mb-6">
                {(['avg_response_time', 'min_response_time', 'max_response_time', 'success_rate', 'throughput'] as MetricTab[]).map((tab) => (
                  <button
                    key={tab}
                    className={`py-2 px-4 text-sm font-medium ${
                      activeTab === tab 
                        ? 'border-b-2 border-blue-500 text-blue-600' 
                        : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {getTabName(tab)}
                  </button>
                ))}
              </div>
              
              {/* Chart for the selected metric */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="text-sm font-medium mb-4">{getTabName(activeTab)} vs Concurrency</h4>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="concurrency" 
                      label={{ value: 'Concurrency', position: 'insideBottom', offset: -5 }} 
                    />
                    <YAxis 
                      label={{ value: getYAxisLabel(activeTab), angle: -90, position: 'insideLeft' }} 
                      domain={getYAxisDomain(activeTab)}
                    />
                    <Tooltip 
                      formatter={(value, name, props) => {
                        // Extract endpoint name from the data key
                        if (typeof name === 'string' && name.includes('_')) {
                          const endpointKey = name.split('_')[0];
                          const originalName = props.payload[`${endpointKey}_name`];
                          return [formatMetricValue(value, activeTab), originalName || name];
                        }
                        return [value, name];
                      }}
                    />
                    <Legend />
                    
                    {/* Generate a line for each endpoint */}
                    {testResults?.summary?.concurrency_metrics && 
                      Object.keys(testResults.summary.concurrency_metrics).map((endpoint, index) => {
                        const safeEndpointName = endpoint.replace(/[^a-zA-Z0-9]/g, '_');
                        const dataKey = `${safeEndpointName}_${activeTab}`;
                        const color = endpointColors[index % endpointColors.length];
                        
                        return (
                          <Line 
                            key={endpoint}
                            type="monotone" 
                            dataKey={dataKey} 
                            name={endpoint} 
                            stroke={color}
                            activeDot={{ r: 8 }}
                            dot={{ strokeWidth: 2 }}
                          />
                        );
                      })
                    }
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 