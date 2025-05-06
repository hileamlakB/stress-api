import { useState } from 'react';
import { CheckCircle, XCircle, Clock, BarChart2, ArrowUpRight } from 'lucide-react';
import { DemoMetricsChart } from '../../DemoMetricsChart';
import { useWizard } from '../WizardContext';

const demoEndpoints = [
  { method: 'GET', path: '/api/users', color: '#8884d8' },
  { method: 'GET', path: '/api/products', color: '#82ca9d' },
  { method: 'POST', path: '/api/orders', color: '#ffc658' },
  { method: 'GET', path: '/api/search', color: '#ff8042' },
  { method: 'POST', path: '/api/auth/login', color: '#a4de6c' },
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

export function ResultsStep() {
  const { activeTestId } = useWizard();
  const [currentChartIndex, setCurrentChartIndex] = useState(0);
  const [selectedEndpoint, setSelectedEndpoint] = useState(demoEndpoints[0].method + ' ' + demoEndpoints[0].path);
  
  const currentChart = chartTypes[currentChartIndex];
  
  // Static test summary data that matches the completion dialog
  const testSummary = {
    totalRequests: 250,
    successfulRequests: 246,
    failedRequests: 4,
    successRate: 98.4,
    avgResponseTime: 215,
    minResponseTime: 87,
    maxResponseTime: 543,
    elapsedTime: 5.0,
    peakConcurrentRequests: 50
  };
  
  // Static endpoint metrics
  const endpointMetrics = demoEndpoints.map((endpoint, index) => {
    const baseSuccessRate = testSummary.successRate - (index * 0.5);
    const baseAvgResponse = testSummary.avgResponseTime - (index * 15);
    
    return {
      endpoint: endpoint.method + ' ' + endpoint.path,
      color: endpoint.color,
      successRate: Math.max(95, Math.min(100, baseSuccessRate)),
      successCount: Math.floor((250 / demoEndpoints.length) * (baseSuccessRate / 100)),
      failureCount: Math.floor((250 / demoEndpoints.length) * ((100 - baseSuccessRate) / 100)),
      responseTime: {
        avg: baseAvgResponse,
        min: baseAvgResponse * 0.4,
        max: baseAvgResponse * 2.5
      },
      statusCodes: {
        '200': Math.floor((250 / demoEndpoints.length) * 0.9),
        '201': index === 2 || index === 4 ? Math.floor((250 / demoEndpoints.length) * 0.08) : 0,
        '400': Math.floor((250 / demoEndpoints.length) * 0.01),
        '404': index === 3 ? Math.floor((250 / demoEndpoints.length) * 0.01) : 0,
        '500': Math.floor((250 / demoEndpoints.length) * 0.005)
      }
    };
  });
  
  const selectedEndpointData = endpointMetrics.find(metric => metric.endpoint === selectedEndpoint);
  
  return (
    <div className="space-y-6">
      <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
        <div className="flex">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <div className="ml-3">
            <p className="text-sm text-green-700">
              Stress test completed successfully. Results and metrics are displayed below.
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Test Results</h2>
          <p className="text-sm text-gray-500">Test ID: demo-{Date.now().toString().substring(0, 10)}</p>
        </div>
        
        <div className="p-6 space-y-6">
          {/* High-level metrics cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <BarChart2 className="h-5 w-5 text-blue-500 mr-2" />
                <h3 className="text-sm font-medium text-gray-500">Total Requests</h3>
              </div>
              <p className="mt-2 text-2xl font-semibold">{testSummary.totalRequests.toLocaleString()}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-blue-500 mr-2" />
                <h3 className="text-sm font-medium text-gray-500">Elapsed Time</h3>
              </div>
              <p className="mt-2 text-2xl font-semibold">{testSummary.elapsedTime.toFixed(1)}s</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <h3 className="text-sm font-medium text-gray-500">Success Rate</h3>
              </div>
              <p className="mt-2 text-2xl font-semibold text-green-600">{testSummary.successRate.toFixed(1)}%</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <ArrowUpRight className="h-5 w-5 text-blue-500 mr-2" />
                <h3 className="text-sm font-medium text-gray-500">Avg. Response</h3>
              </div>
              <p className="mt-2 text-2xl font-semibold">{testSummary.avgResponseTime}ms</p>
            </div>
          </div>
          
          {/* Endpoint details */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 p-4">
              <h3 className="text-lg font-medium">Endpoint Performance</h3>
              <div className="mt-2">
                <select 
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={selectedEndpoint}
                  onChange={(e) => setSelectedEndpoint(e.target.value)}
                >
                  {endpointMetrics.map(metric => (
                    <option key={metric.endpoint} value={metric.endpoint}>
                      {metric.endpoint}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {selectedEndpointData && (
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {/* Success/Failure */}
                  <div className="bg-gray-50 rounded p-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Success / Failure</h4>
                    <div className="flex items-end">
                      <div 
                        className="h-8 rounded-l bg-green-500" 
                        style={{ width: `${selectedEndpointData.successRate}%` }} 
                      ></div>
                      <div 
                        className="h-8 rounded-r bg-red-500" 
                        style={{ width: `${100 - selectedEndpointData.successRate}%` }} 
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>{selectedEndpointData.successCount} successful ({selectedEndpointData.successRate.toFixed(1)}%)</span>
                      <span>{selectedEndpointData.failureCount} failed</span>
                    </div>
                  </div>
                  
                  {/* Response Times */}
                  <div className="bg-gray-50 rounded p-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-3">Response Times</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Average:</span>
                        <span className="text-xs font-medium">{selectedEndpointData.responseTime.avg.toFixed(2)} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Minimum:</span>
                        <span className="text-xs font-medium">{selectedEndpointData.responseTime.min.toFixed(2)} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Maximum:</span>
                        <span className="text-xs font-medium">{selectedEndpointData.responseTime.max.toFixed(2)} ms</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Codes */}
                  <div className="bg-gray-50 rounded p-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Status Codes</h4>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {Object.entries(selectedEndpointData.statusCodes).map(([code, count]) => (
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
              </div>
            )}
          </div>
          
          {/* Charts */}
          <div className="bg-white rounded-lg border border-gray-200">
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
          
          {/* Test Configuration Summary */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 p-4">
              <h3 className="text-lg font-medium">Test Configuration</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">General Settings</h4>
                  <div className="bg-gray-50 p-3 rounded-md space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Concurrent Users:</span>
                      <span className="text-sm font-medium">{testSummary.peakConcurrentRequests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Distribution Strategy:</span>
                      <span className="text-sm font-medium">Interleaved</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Test Duration:</span>
                      <span className="text-sm font-medium">{testSummary.elapsedTime} seconds</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Tested Endpoints</h4>
                  <div className="bg-gray-50 p-3 rounded-md space-y-2 max-h-40 overflow-y-auto">
                    {demoEndpoints.map((endpoint, index) => (
                      <div key={index} className="flex items-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          endpoint.method === 'GET' 
                            ? 'bg-blue-100 text-blue-800' 
                            : endpoint.method === 'POST'
                            ? 'bg-green-100 text-green-800'
                            : endpoint.method === 'PUT'
                            ? 'bg-yellow-100 text-yellow-800'
                            : endpoint.method === 'DELETE'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {endpoint.method}
                        </span>
                        <span className="ml-2 text-sm text-gray-800">{endpoint.path}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 