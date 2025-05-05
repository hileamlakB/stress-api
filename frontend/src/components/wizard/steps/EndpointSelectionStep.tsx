import { useState, useMemo, useRef, useEffect } from 'react';
import { RefreshCw, Filter, Link, Info } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';
import apiService from '../../../services/ApiService';

export function EndpointSelectionStep() {
  const { 
    baseUrl,
    endpoints, 
    setEndpoints,
    selectedEndpoints,
    setSelectedEndpoints,
    activeEndpointTab,
    setActiveEndpointTab,
    endpointMethodFilter,
    setEndpointMethodFilter
  } = useWizard();

  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(false);
  const [endpointFilter, setEndpointFilter] = useState('');
  const [advancedFiltering, setAdvancedFiltering] = useState(false);
  const [showDetailsCard, setShowDetailsCard] = useState(false);
  const [selectedEndpointDetails, setSelectedEndpointDetails] = useState<any>(null);
  
  // Refs for maintaining scroll position
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);
  
  // Save scroll position before any state updates that might cause rerenders
  const saveScrollPosition = () => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
  };
  
  // Restore scroll position after component updates
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollPositionRef.current;
    }
  }, [activeEndpointTab, endpointMethodFilter]);

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
    // Guard against empty endpoints
    if (!endpoints || endpoints.length === 0) {
      return [];
    }

    // Guard against endpointGroups not being initialized yet
    if (!endpointGroups) {
      return endpoints;
    }
    
    let filtered = endpoints;
    
    // Filter by tab group if not "all"
    if (activeEndpointTab !== 'all') {
      filtered = endpointGroups[activeEndpointTab] || [];
    }
    
    // Filter by method if not "all" - use context variable
    if (endpointMethodFilter !== 'all') {
      filtered = filtered.filter(ep => ep.method === endpointMethodFilter);
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
  }, [endpoints, endpointGroups, activeEndpointTab, endpointMethodFilter, endpointFilter]);
  
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

  // Handler for the details click
  const handleDetailsClick = (e: React.MouseEvent, endpoint: any) => {
    e.stopPropagation(); // Prevent triggering the row's onClick (which toggles selection)
    setSelectedEndpointDetails(endpoint);
    setShowDetailsCard(true);
  };

  // Function to close the details card
  const closeDetailsCard = () => {
    setShowDetailsCard(false);
    setSelectedEndpointDetails(null);
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
                    value={endpointMethodFilter}
                    onChange={(e) => setEndpointMethodFilter(e.target.value)}
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
                  onClick={() => setActiveEndpointTab(tab)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap ${
                    activeEndpointTab === tab
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
            
            <div 
              ref={scrollContainerRef}
              className="max-h-64 overflow-y-auto"
            >
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
                      onClick={() => {
                        saveScrollPosition();
                        handleToggleEndpoint(endpoint);
                      }}
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
                      <div 
                        className="w-24 text-xs text-gray-500 truncate flex items-center hover:text-blue-500 cursor-pointer"
                        onClick={(e) => handleDetailsClick(e, endpoint)}
                      >
                        <span className="truncate">{endpoint.summary || endpoint.description || '-'}</span>
                        <Info className="h-3.5 w-3.5 ml-1" />
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

      {/* Details Card/Modal */}
      {showDetailsCard && selectedEndpointDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closeDetailsCard}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Endpoint Details
              </h3>
              <button onClick={closeDetailsCard} className="text-gray-400 hover:text-gray-500">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="px-6 py-4">
              <div className="mb-4">
                <span className={`inline-block text-sm font-medium px-2.5 py-1 rounded-full ${
                  selectedEndpointDetails.method === 'GET' 
                    ? 'bg-blue-100 text-blue-800' 
                    : selectedEndpointDetails.method === 'POST'
                    ? 'bg-green-100 text-green-800'
                    : selectedEndpointDetails.method === 'PUT'
                    ? 'bg-yellow-100 text-yellow-800'
                    : selectedEndpointDetails.method === 'DELETE'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {selectedEndpointDetails.method}
                </span>
                <span className="ml-2 text-gray-700 font-mono">{selectedEndpointDetails.path}</span>
              </div>
              
              {selectedEndpointDetails.summary && (
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Summary</h4>
                  <p className="text-sm text-gray-600">{selectedEndpointDetails.summary}</p>
                </div>
              )}
              
              {selectedEndpointDetails.description && (
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                  <p className="text-sm text-gray-600">{selectedEndpointDetails.description}</p>
                </div>
              )}
              
              {selectedEndpointDetails.parameters && selectedEndpointDetails.parameters.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Parameters</h4>
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 border-b border-gray-200 grid grid-cols-4">
                      <div>Name</div>
                      <div>Location</div>
                      <div>Type</div>
                      <div>Required</div>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {selectedEndpointDetails.parameters.map((param: any, index: number) => (
                        <div key={index} className="px-4 py-2 text-xs grid grid-cols-4">
                          <div className="font-medium text-gray-800">{param.name}</div>
                          <div className="text-gray-600">{param.in}</div>
                          <div className="text-gray-600">{param.schema?.type || '-'}</div>
                          <div className="text-gray-600">{param.required ? 'Yes' : 'No'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {selectedEndpointDetails.responses && Object.keys(selectedEndpointDetails.responses).length > 0 && (
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Responses</h4>
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 border-b border-gray-200 grid grid-cols-2">
                      <div>Status</div>
                      <div>Description</div>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {Object.entries(selectedEndpointDetails.responses).map(([status, response]: [string, any]) => (
                        <div key={status} className="px-4 py-2 text-xs grid grid-cols-2">
                          <div className="font-medium text-gray-800">{status}</div>
                          <div className="text-gray-600">{response.description || '-'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button 
                onClick={closeDetailsCard}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 