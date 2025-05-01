import { useState, useMemo } from 'react';
import { RefreshCw, Filter, Link } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';
import apiService from '../../../services/ApiService';

export function EndpointSelectionStep() {
  const { 
    baseUrl,
    endpoints, 
    setEndpoints,
    selectedEndpoints,
    setSelectedEndpoints
  } = useWizard();

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
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              Now, fetch the available endpoints from your API and select which ones you want to include in your stress test.
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-center space-x-4 mb-6">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900">Available Endpoints</h3>
        </div>
        <div className="flex items-center">
          <Button
            onClick={fetchEndpoints}
            disabled={isLoadingEndpoints || !baseUrl}
            className="inline-flex items-center justify-center min-w-[140px]"
            size="sm"
            variant="primary"
          >
            {isLoadingEndpoints ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Fetch Endpoints
          </Button>
        </div>
      </div>
      
      {endpoints.length > 0 && (
        <>
          <div className="flex flex-col space-y-4 mb-4">
            {/* Filtering controls */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[300px]">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Filter className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={endpointFilter}
                    onChange={(e) => setEndpointFilter(e.target.value)}
                    placeholder="Filter endpoints (path, method, description)"
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="primary" onClick={handleSelectAllEndpoints}>
                  Select All
                </Button>
                <Button size="sm" variant="outline" onClick={handleClearSelection}>
                  Clear Selection
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setAdvancedFiltering(!advancedFiltering)}
                  className="inline-flex items-center"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {advancedFiltering ? 'Hide Filters' : 'More Filters'}
                </Button>
              </div>
            </div>

            {/* Advanced filtering options */}
            {advancedFiltering && (
              <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-md">
                <div className="flex items-center min-w-[200px]">
                  <label htmlFor="methodFilter" className="block text-sm font-medium text-gray-700 mr-3">
                    Method:
                  </label>
                  <select
                    id="methodFilter"
                    value={filterByMethod}
                    onChange={(e) => setFilterByMethod(e.target.value)}
                    className="flex-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 py-1.5 px-3"
                  >
                    {availableMethods.map(method => (
                      <option key={method} value={method}>
                        {method === 'all' ? 'All Methods' : method}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500">
                    Found {filteredEndpoints.length} of {endpoints.length} endpoints
                  </span>
                </div>
              </div>
            )}

            {/* Endpoint grouping tabs */}
            <div className="flex overflow-x-auto space-x-1 pt-3 pb-2 border-b border-gray-200">
              {availableTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap ${
                    activeTab === tab
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tab === 'all' ? 'All Endpoints' : `/${tab}`}
                  <span className="ml-1 text-xs text-gray-500">
                    ({tab === 'all' ? endpoints.length : (endpointGroups[tab]?.length || 0)})
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 border border-gray-200 rounded-md overflow-hidden">
            <div className="flex bg-gray-100 px-4 py-2 border-b border-gray-200">
              <div className="w-8"></div>
              <div className="w-16 text-xs font-medium text-gray-500">METHOD</div>
              <div className="flex-1 text-xs font-medium text-gray-500">ENDPOINT</div>
              <div className="w-24 text-xs font-medium text-gray-500">DETAILS</div>
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
                      </div>
                      <div className="flex-1 text-sm text-gray-700">
                        {endpoint.path}
                      </div>
                      <div className="w-24 text-xs text-gray-500 truncate">
                        {endpoint.summary || endpoint.description || '-'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          <div className="mt-2 text-sm text-gray-500">
            {selectedEndpoints.length > 0 ? 
              `Selected ${selectedEndpoints.length} endpoint${selectedEndpoints.length === 1 ? '' : 's'}` : 
              'No endpoints selected yet. Please select at least one endpoint to continue.'}
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
      
      {isLoadingEndpoints && (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin" />
            <p className="mt-4 text-gray-600">Loading endpoints...</p>
          </div>
        </div>
      )}
    </div>
  );
} 