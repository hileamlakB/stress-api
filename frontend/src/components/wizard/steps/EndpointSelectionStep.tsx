import { useState, useMemo } from 'react';
import { RefreshCw, Filter, Link } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';
import { useTheme } from '../../../contexts/ThemeContext';
import apiService from '../../../services/ApiService';

export function EndpointSelectionStep() {
  const { 
    baseUrl,
    endpoints, 
    setEndpoints,
    selectedEndpoints,
    setSelectedEndpoints
  } = useWizard();
  const { isDarkMode } = useTheme();

  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(false);
  const [endpointFilter, setEndpointFilter] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [filterByMethod, setFilterByMethod] = useState<string>('all');
  const [advancedFiltering, setAdvancedFiltering] = useState(false);
  
  // Group endpoints into tabs based on URL patterns
  const endpointGroups = useMemo(() => {
    // Start with the "all" group
    const groups: Record<string, any[]> = { all: endpoints };
    
    // Group endpoints by the first part of the path
    endpoints.forEach(endpoint => {
      // Extract the first segment of the path after removing leading slash
      const pathSegments = endpoint.path.split('/').filter(Boolean);
      const firstSegment = pathSegments.length > 0 ? pathSegments[0] : 'root';
      
      // Add to the group
      if (!groups[firstSegment]) {
        groups[firstSegment] = [];
      }
      groups[firstSegment].push(endpoint);
    });
    
    return groups;
  }, [endpoints]);
  
  // Available tabs derived from endpoint groups
  const availableTabs = useMemo(() => {
    return ['all', ...Object.keys(endpointGroups).filter(group => group !== 'all')];
  }, [endpointGroups]);

  // Get unique methods from endpoints for the method filter dropdown
  const availableMethods = useMemo(() => {
    const methods = new Set<string>();
    endpoints.forEach(ep => methods.add(ep.method));
    return ['all', ...Array.from(methods)];
  }, [endpoints]);

  // Filter endpoints based on active tab, filter text, and method filter
  const filteredEndpoints = useMemo(() => {
    let filtered = endpoints;
    
    // Filter by tab group if not "all"
    if (activeTab !== 'all') {
      filtered = endpointGroups[activeTab] || [];
    }
    
    // Filter by method if not "all"
    if (filterByMethod !== 'all') {
      filtered = filtered.filter(ep => ep.method === filterByMethod);
    }
    
    // Text filter on path or method
    if (endpointFilter) {
      const lowerFilter = endpointFilter.toLowerCase();
      filtered = filtered.filter(ep => 
        ep.path.toLowerCase().includes(lowerFilter) || 
        ep.method.toLowerCase().includes(lowerFilter) ||
        (ep.description && ep.description.toLowerCase().includes(lowerFilter)) ||
        (ep.summary && ep.summary.toLowerCase().includes(lowerFilter))
      );
    }
    
    return filtered;
  }, [endpoints, endpointGroups, activeTab, filterByMethod, endpointFilter]);
  
  const fetchEndpoints = async () => {
    if (!baseUrl) {
      alert('Please enter a FastAPI Base URL in the previous step');
      return;
    }

    // Clean up the URL
    let cleanUrl = baseUrl.trim();
    // Ensure the URL has a protocol
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    
    setIsLoadingEndpoints(true);
    setEndpoints([]); // Clear any previous endpoints
    
    try {
      // Call the backend API to fetch endpoints
      const endpointData = await apiService.fetchEndpoints(cleanUrl);
      
      // Map the endpoint data to our simplified format
      const mappedEndpoints = endpointData.map((endpoint: any) => ({
        method: endpoint.method,
        path: endpoint.path,
        description: endpoint.description || endpoint.summary,
        summary: endpoint.summary,
        parameters: endpoint.parameters || [],
        responses: endpoint.responses || {}
      }));
      
      if (mappedEndpoints.length === 0) {
        alert('No endpoints were found for this API. Please verify the URL is correct and the API uses FastAPI with OpenAPI/Swagger documentation.');
      } else {
        console.log(`Successfully fetched ${mappedEndpoints.length} endpoints`);
        setEndpoints(mappedEndpoints);
      }
      
      setIsLoadingEndpoints(false);
    } catch (error: any) {
      console.error('Error fetching endpoints:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide user-friendly error message
      let userMessage = 'Failed to fetch endpoints: ' + errorMessage;
      
      // Create more specific error messages for common issues
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Failed to connect')) {
        userMessage = `Could not connect to the API at ${cleanUrl}. Please check that the URL is correct and the server is running.`;
      } else if (errorMessage.includes('not accessible: HTTP 404')) {
        userMessage = `The API server at ${cleanUrl} was found but returned a 404 Not Found error. Please verify the base URL is correct.`;
      } else if (errorMessage.includes('not appear to support OpenAPI/Swagger')) {
        userMessage = `This API does not appear to support OpenAPI/Swagger. Only FastAPI or Swagger-enabled APIs are supported.`;
      } else if (errorMessage.includes('non-standard OpenAPI schema location')) {
        userMessage = errorMessage;
      } else if (errorMessage.includes('Network Error')) {
        userMessage = `Network error connecting to ${cleanUrl}. This might be due to CORS restrictions or the server being unreachable.`;
      }
      
      alert(userMessage);
      setIsLoadingEndpoints(false);
    }
  };

  const handleSelectAllEndpoints = () => {
    setSelectedEndpoints(endpoints.map(endpoint => `${endpoint.method} ${endpoint.path}`));
  };

  const handleClearSelection = () => {
    setSelectedEndpoints([]);
  };

  const handleToggleEndpoint = (endpoint: any) => {
    const endpointKey = `${endpoint.method} ${endpoint.path}`;
    if (selectedEndpoints.includes(endpointKey)) {
      setSelectedEndpoints(selectedEndpoints.filter(ep => ep !== endpointKey));
    } else {
      setSelectedEndpoints([...selectedEndpoints, endpointKey]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Message */}
      <div className={`bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-400 dark:border-blue-500 p-4`}>
        <div className="flex">
          <div className="ml-3">
            <p className={`text-sm text-blue-700 dark:text-blue-200`}>
              Now, fetch the available endpoints from your API and select which ones you want to include in your stress test.
            </p>
          </div>
        </div>
      </div>

      {/* Endpoint Selection Area */}
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow`}>
        <div className={`p-4 border-b border-gray-200 dark:border-gray-700`}>
          <div className="flex justify-between items-center">
            <h3 className={`text-lg font-medium text-gray-900 dark:text-gray-100`}>Available Endpoints</h3>
            <Button
              onClick={fetchEndpoints}
              disabled={isLoadingEndpoints || !baseUrl}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingEndpoints ? 'animate-spin' : ''}`} />
              {isLoadingEndpoints ? 'Fetching...' : 'Fetch Endpoints'}
            </Button>
          </div>
        </div>

        {endpoints.length > 0 ? (
          <div className="p-4">
            {/* Search and Filter Bar */}
            <div className="mb-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className={`h-4 w-4 text-gray-400 dark:text-gray-500`} />
                </div>
                <input
                  type="text"
                  value={endpointFilter}
                  onChange={(e) => setEndpointFilter(e.target.value)}
                  placeholder="Filter endpoints..."
                  className={`w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400`}
                />
              </div>
              
              {/* Advanced Filtering Toggle */}
              <div className="mt-2 flex items-center">
                <input
                  type="checkbox"
                  id="advancedFiltering"
                  checked={advancedFiltering}
                  onChange={() => setAdvancedFiltering(!advancedFiltering)}
                  className={`h-4 w-4 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-600 rounded`}
                />
                <label htmlFor="advancedFiltering" className={`ml-2 text-sm text-gray-700 dark:text-gray-300`}>
                  Show advanced filtering options
                </label>
              </div>

              {/* Advanced Filtering Options */}
              {advancedFiltering && (
                <div className="mt-3 flex items-center space-x-4">
                  <div>
                    <label htmlFor="methodFilter" className={`block text-sm font-medium text-gray-700 dark:text-gray-300`}>
                      HTTP Method:
                    </label>
                    <select
                      id="methodFilter"
                      value={filterByMethod}
                      onChange={(e) => setFilterByMethod(e.target.value)}
                      className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 sm:text-sm rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                    >
                      <option value="all">All Methods</option>
                      {Array.from(availableMethods).map(method => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Endpoint Groups Tabs */}
            <div className={`border-b border-gray-200 dark:border-gray-700`}>
              <nav className="-mb-px flex space-x-4">
                {availableTabs.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`whitespace-nowrap py-2 px-3 border-b-2 text-sm font-medium ${
                      activeTab === tab
                        ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {tab === 'all' ? 'All' : `/${tab}`}
                  </button>
                ))}
              </nav>
            </div>

            {/* Endpoints List */}
            <div className="mt-4">
              <div className={`border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden`}>
                <div className={`bg-gray-50 dark:bg-gray-900 px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider`}>
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-1"></div>
                    <div className="col-span-2">Method</div>
                    <div className="col-span-6">Path</div>
                    <div className="col-span-3">Description</div>
                  </div>
                </div>

                <div className={`divide-y divide-gray-200 dark:divide-gray-700`}>
                  {filteredEndpoints.map((endpoint, index) => (
                    <div
                      key={`${endpoint.method}-${endpoint.path}`}
                      className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                        selectedEndpoints.includes(endpoint)
                          ? 'bg-indigo-50 dark:bg-indigo-900'
                          : ''
                      }`}
                    >
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1">
                          <input
                            type="checkbox"
                            checked={selectedEndpoints.includes(endpoint)}
                            onChange={() => handleToggleEndpoint(endpoint)}
                            className={`h-4 w-4 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 border-gray-300 dark:border-gray-600 rounded`}
                          />
                        </div>
                        <div className="col-span-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            endpoint.method === 'GET'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              : endpoint.method === 'POST'
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                              : endpoint.method === 'PUT'
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          }`}>
                            {endpoint.method}
                          </span>
                        </div>
                        <div className="col-span-6 text-sm text-gray-900 dark:text-gray-100">
                          {endpoint.path}
                        </div>
                        <div className="col-span-3 text-sm text-gray-500 dark:text-gray-400">
                          {endpoint.description || '-'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Selection Summary */}
            <div className="mt-4 flex justify-between items-center">
              <p className={`text-sm text-gray-500 dark:text-gray-400`}>
                Selected {selectedEndpoints.length} of {endpoints.length} endpoints
              </p>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  onClick={handleSelectAllEndpoints}
                  className="text-sm"
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearSelection}
                  className="text-sm"
                >
                  Deselect All
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            {isLoadingEndpoints ? (
              <div className="flex flex-col items-center">
                <RefreshCw className="h-8 w-8 text-gray-400 dark:text-gray-500 animate-spin" />
                <p className={`mt-2 text-gray-500 dark:text-gray-400`}>Loading endpoints...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Link className="h-12 w-12 text-gray-400 dark:text-gray-500" />
                <h3 className={`mt-2 text-sm font-medium text-gray-900 dark:text-gray-100`}>No endpoints found</h3>
                <p className={`mt-1 text-sm text-gray-500 dark:text-gray-400`}>
                  Click "Fetch Endpoints" to load available endpoints from your API
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}