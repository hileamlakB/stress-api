import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Settings, LogOut, ChevronRight, Play, RefreshCw, Link } from 'lucide-react';
import { Button } from '../components/Button';
import { signOut, getCurrentUser } from '../lib/auth';
import { MetricsPanel } from '../components/MetricsPanel';
import { DemoMetricsPanel } from '../components/DemoMetricsPanel';
import apiService from '../services/ApiService';
import { EndpointSchema, DistributionStrategy } from '../types/api';

// Define types for our state
type Endpoint = {
  method: string;
  path: string;
  description?: string;
};

export function Dashboard() {
  // Base configuration state
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [showAuthConfig, setShowAuthConfig] = useState(false);
  
  // Authentication state
  const [authJson, setAuthJson] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Endpoints state
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([]);
  const [endpointFilter, setEndpointFilter] = useState('');
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(false);
  
  // Test configuration state
  const [concurrentRequests, setConcurrentRequests] = useState(10);
  const [distributionMode, setDistributionMode] = useState<DistributionStrategy>('sequential');
  
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        navigate('/login');
      }
    } catch (error) {
      navigate('/login');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const fetchEndpoints = async () => {
    if (!baseUrl) {
      alert('Please enter a FastAPI Base URL');
      return;
    }

    setIsLoadingEndpoints(true);
    try {
      // Call the backend API to fetch endpoints
      const endpointData = await apiService.fetchEndpoints(baseUrl);
      
      // Map the endpoint data to our simplified format
      const mappedEndpoints: Endpoint[] = endpointData.map(endpoint => ({
        method: endpoint.method,
        path: endpoint.path,
        description: endpoint.description || endpoint.summary
      }));
      
      setEndpoints(mappedEndpoints);
      setIsLoadingEndpoints(false);
    } catch (error) {
      console.error('Error fetching endpoints:', error);
      alert('Failed to fetch endpoints: ' + (error instanceof Error ? error.message : String(error)));
      setIsLoadingEndpoints(false);
    }
  };

  const handleSelectAllEndpoints = () => {
    setSelectedEndpoints(endpoints.map(endpoint => `${endpoint.method} ${endpoint.path}`));
  };

  const handleClearSelection = () => {
    setSelectedEndpoints([]);
  };

  const handleToggleEndpoint = (endpoint: Endpoint) => {
    const endpointKey = `${endpoint.method} ${endpoint.path}`;
    if (selectedEndpoints.includes(endpointKey)) {
      setSelectedEndpoints(selectedEndpoints.filter(ep => ep !== endpointKey));
    } else {
      setSelectedEndpoints([...selectedEndpoints, endpointKey]);
    }
  };

  const validateAuthJson = (json: string): boolean => {
    if (!json.trim()) {
      return true; // Empty is valid
    }
    
    try {
      JSON.parse(json);
      setAuthError('');
      return true;
    } catch (error) {
      setAuthError('Invalid JSON format');
      return false;
    }
  };

  const filteredEndpoints = endpoints.filter(endpoint => {
    const searchTerm = endpointFilter.toLowerCase();
    return (
      endpoint.method.toLowerCase().includes(searchTerm) ||
      endpoint.path.toLowerCase().includes(searchTerm)
    );
  });

  const startLoadTest = async () => {
    if (!baseUrl) {
      alert('Please enter a FastAPI Base URL');
      return;
    }

    if (selectedEndpoints.length === 0) {
      alert('Please select at least one endpoint to test');
      return;
    }

    if (authJson && !validateAuthJson(authJson)) {
      return;
    }

    setLoading(true);
    try {
      // Prepare headers from authJson
      let headers = {};
      if (authJson) {
        headers = JSON.parse(authJson);
      }

      // Prepare endpoints config
      const endpointConfigs = selectedEndpoints.map(endpoint => {
        const [method, path] = endpoint.split(' ');
        return {
          method,
          path,
          weight: 1.0
        };
      });

      // Create test config
      const testConfig = {
        target_url: baseUrl,
        strategy: distributionMode,
        max_concurrent_users: concurrentRequests,
        request_rate: 10,  // Default value
        duration: 60,      // Default value
        endpoints: endpointConfigs,
        headers,
        use_random_session: false
      };

      // For now, just simulate a response
      // In a real implementation, uncomment this to call the actual API
      // const response = await apiService.startStressTest(testConfig);
      // setActiveTestId(response.test_id);
      
      // Simulation for now
      setTimeout(() => {
        setActiveTestId(`test-${Math.random().toString(36).substr(2, 9)}`);
        setLoading(false);
      }, 1500);
    } catch (error) {
      console.error('Error starting load test:', error);
      alert('Failed to start load test');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Zap className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold">FastAPI Stress Tester 🚀</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {}}
                className="flex items-center"
              >
                <Settings className="h-5 w-5 mr-1" />
                Settings
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center"
              >
                <LogOut className="h-5 w-5 mr-1" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">Configuration</h2>
          
          {/* FastAPI Base URL */}
          <div className="mb-6">
            <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 mb-1">
              FastAPI Base URL
            </label>
            <div className="flex space-x-4">
              <input
                id="baseUrl"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.thebighalo.com"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          
          {/* Authentication Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h3 className="text-lg font-medium text-gray-900">Authentication</h3>
                <button 
                  onClick={() => setShowAuthConfig(!showAuthConfig)}
                  className="ml-2 text-indigo-600 hover:text-indigo-800"
                >
                  {showAuthConfig ? '(hide)' : '(show)'}
                </button>
              </div>
            </div>
            
            {showAuthConfig && (
              <div className="mt-3 space-y-4">
                <div>
                  <div className="flex justify-between">
                    <label htmlFor="authConfig" className="block text-sm font-medium text-gray-700 mb-1">
                      Authentication Headers (JSON)
                    </label>
                    {authError && <span className="text-sm text-red-600">{authError}</span>}
                  </div>
                  <textarea
                    id="authConfig"
                    value={authJson}
                    onChange={(e) => {
                      setAuthJson(e.target.value);
                      validateAuthJson(e.target.value);
                    }}
                    placeholder='{"Authorization": "Bearer token123", "x-api-key": "your-api-key"}'
                    rows={4}
                    className={`w-full px-4 py-2 border ${
                      authError ? 'border-red-500' : 'border-gray-300'
                    } rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Enter authentication headers in JSON format that will be included with requests
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Session Manager</h4>
                  <div className="bg-green-100 border border-green-200 rounded-md p-3">
                    <div className="text-sm text-green-800 font-medium">
                      Status: Authenticated (11 active sessions)
                    </div>
                    <div className="mt-1 text-xs text-green-700 flex items-center">
                      <span role="img" aria-label="key" className="mr-1">🔑</span>
                      Active session: user-5f005403
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      The Session Manager tracks active API sessions and maintains authentication state for your stress tests.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Available Endpoints Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-900">Available Endpoints</h3>
              <Button
                onClick={fetchEndpoints}
                disabled={isLoadingEndpoints || !baseUrl}
                className="flex items-center"
                size="sm"
              >
                {isLoadingEndpoints ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Fetch Endpoints
              </Button>
            </div>
            
            {endpoints.length > 0 && (
              <>
                <div className="flex mb-2 items-center">
                  <input
                    type="text"
                    value={endpointFilter}
                    onChange={(e) => setEndpointFilter(e.target.value)}
                    placeholder="Filter endpoints (path or method)"
                    className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="ml-4 space-x-2">
                    <Button size="xs" onClick={handleSelectAllEndpoints}>
                      Select All
                    </Button>
                    <Button size="xs" variant="outline" onClick={handleClearSelection}>
                      Clear Selection
                    </Button>
                  </div>
                </div>
                
                <div className="mt-3 border border-gray-200 rounded-md overflow-hidden">
                  <div className="flex bg-gray-100 px-4 py-2 border-b border-gray-200">
                    <div className="w-8"></div>
                    <div className="w-16 text-xs font-medium text-gray-500">METHOD</div>
                    <div className="flex-1 text-xs font-medium text-gray-500">ENDPOINT</div>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto">
                    {filteredEndpoints.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-600">
                        No endpoints match your filter
                      </div>
                    ) : (
                      filteredEndpoints.map((endpoint, index) => {
                        const endpointKey = `${endpoint.method} ${endpoint.path}`;
                        const isSelected = selectedEndpoints.includes(endpointKey);
                        
                        return (
                          <div 
                            key={index}
                            onClick={() => handleToggleEndpoint(endpoint)}
                            className={`flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                              index !== filteredEndpoints.length - 1 ? 'border-b border-gray-100' : ''
                            }`}
                          >
                            <div className="w-8">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                            </div>
                            <div className="w-16">
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                endpoint.method === 'GET' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {endpoint.method}
                              </span>
                            </div>
                            <div className="flex-1 text-sm text-gray-700">
                              {endpoint.path}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                
                <div className="mt-2 text-sm text-gray-500">
                  Selected {selectedEndpoints.length} endpoints
                </div>
              </>
            )}
            
            {!endpoints.length && !isLoadingEndpoints && (
              <div className="border border-gray-200 rounded-md p-8 flex flex-col items-center justify-center text-center">
                <Link className="h-12 w-12 text-gray-400 mb-2" />
                <h4 className="text-gray-900 font-medium mb-1">No Endpoints Available</h4>
                <p className="text-gray-500 text-sm mb-4">
                  Enter a FastAPI base URL and click "Fetch Endpoints" to get started
                </p>
              </div>
            )}
          </div>
          
          {/* Test Configuration Section */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Test Configuration</h3>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="concurrentRequests" className="block text-sm font-medium text-gray-700">
                    Maximum Concurrent Requests
                  </label>
                  <span className="text-sm text-gray-500">{concurrentRequests}</span>
                </div>
                <input
                  id="concurrentRequests"
                  type="range"
                  min="1"
                  max="50"
                  value={concurrentRequests}
                  onChange={(e) => setConcurrentRequests(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1</span>
                  <span>50</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Distribution Strategy
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => setDistributionMode('sequential')}
                    className={`border ${
                      distributionMode === 'sequential' 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    } rounded-lg p-3 cursor-pointer transition-colors`}
                  >
                    <div className="flex items-center mb-1">
                      <input
                        type="radio"
                        checked={distributionMode === 'sequential'}
                        readOnly
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-900 ml-2">
                        Sequential testing
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Requests are sent one after another in order
                    </p>
                  </div>
                  
                  <div
                    onClick={() => setDistributionMode('interleaved')}
                    className={`border ${
                      distributionMode === 'interleaved' 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    } rounded-lg p-3 cursor-pointer transition-colors`}
                  >
                    <div className="flex items-center mb-1">
                      <input
                        type="radio"
                        checked={distributionMode === 'interleaved'}
                        readOnly
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-900 ml-2">
                        Interleaved testing
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Requests are distributed evenly across endpoints
                    </p>
                  </div>
                  
                  <div
                    onClick={() => setDistributionMode('random')}
                    className={`border ${
                      distributionMode === 'random' 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    } rounded-lg p-3 cursor-pointer transition-colors`}
                  >
                    <div className="flex items-center mb-1">
                      <input
                        type="radio"
                        checked={distributionMode === 'random'}
                        readOnly
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-900 ml-2">
                        Random distribution
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Requests are sent randomly to selected endpoints
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Run Stress Test Button */}
          <div className="flex justify-end">
            <Button
              onClick={startLoadTest}
              disabled={loading || selectedEndpoints.length === 0}
              className="flex items-center"
              size="lg"
            >
              <Play className="h-5 w-5 mr-2" />
              {loading ? 'Starting...' : 'START STRESS TEST'}
            </Button>
          </div>
        </div>

        {activeTestId ? (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Live Metrics</h2>
              <p className="text-sm text-gray-500">Test ID: {activeTestId}</p>
            </div>
            <MetricsPanel testId={activeTestId} />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Example Visualization</h2>
              <p className="text-sm text-gray-500">This is how your metrics will look during a load test</p>
            </div>
            <DemoMetricsPanel />
          </div>
        )}
      </main>
    </div>
  );
}