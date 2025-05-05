import { useState, useMemo, useCallback } from 'react';
import { RefreshCw, Filter, Link, Info } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';
import apiService from '../../../services/ApiService';
import React from 'react';

// Checkbox component that manages its own state
const EndpointCheckbox = React.memo(({ 
  isChecked,
  onChange
}: { 
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
}) => {
  return (
    <input
      type="checkbox"
      checked={isChecked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
    />
  );
});

// Individual endpoint row component - memoized to prevent rerendering when other rows change
const EndpointRow = React.memo(({ 
  endpoint, 
  isSelected,
  onToggle, 
  onDetails 
}: { 
  endpoint: any; 
  isSelected: boolean;
  onToggle: (endpoint: any, isSelected: boolean) => void; 
  onDetails: (endpoint: any) => void;
}) => {
  // Handlers that don't cause parent rerenders
  const handleRowClick = useCallback(() => {
    onToggle(endpoint, !isSelected);
  }, [endpoint, isSelected, onToggle]);

  const handleCheckboxChange = useCallback((checked: boolean) => {
    onToggle(endpoint, checked);
  }, [endpoint, onToggle]);

  const handleDetailsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDetails(endpoint);
  }, [endpoint, onDetails]);

  // Get endpoint key
  const endpointKey = `${endpoint.method} ${endpoint.path}`;

  return (
    <div 
      onClick={handleRowClick}
      className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
    >
      <div className="w-8">
        <EndpointCheckbox 
          isChecked={isSelected} 
          onChange={handleCheckboxChange}
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
        className="w-24 text-xs text-gray-500 flex items-center justify-between hover:text-blue-500 cursor-pointer group"
        onClick={handleDetailsClick}
      >
        <span className="truncate mr-1">{endpoint.summary || endpoint.description || '-'}</span>
        <Info className="h-4 w-4 flex-shrink-0 opacity-70 group-hover:opacity-100" />
      </div>
    </div>
  );
});

// Isolate endpoint list to prevent rerendering
const EndpointList = React.memo(({
  endpoints,
  selectedKeys,
  onToggleEndpoint,
  onShowDetails
}: {
  endpoints: any[];
  selectedKeys: Set<string>;
  onToggleEndpoint: (endpoint: any, isSelected: boolean) => void;
  onShowDetails: (endpoint: any) => void;
}) => {
  // Empty state
  if (endpoints.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-gray-600">
        No endpoints match your filter
      </div>
    );
  }

  return (
    <>
      {endpoints.map((endpoint) => {
        const key = `${endpoint.method} ${endpoint.path}`;
        return (
          <EndpointRow
            key={key}
            endpoint={endpoint}
            isSelected={selectedKeys.has(key)}
            onToggle={onToggleEndpoint}
            onDetails={onShowDetails}
          />
        );
      })}
    </>
  );
}, (prevProps, nextProps) => {
  // Deep comparison of selectedKeys set
  if (prevProps.endpoints !== nextProps.endpoints) return false;
  if (prevProps.selectedKeys.size !== nextProps.selectedKeys.size) return false;
  
  for (const key of prevProps.selectedKeys) {
    if (!nextProps.selectedKeys.has(key)) return false;
  }
  
  return true;
});

// Main component
/**
 * @param onStepNext - called by the wizard before advancing to the next step. Use to sync local selection to context.
 */
export function EndpointSelectionStep({ onStepNext }: { onStepNext?: () => void } = {}) {
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

  // ---- LOCAL STATE ----
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(false);
  const [endpointFilter, setEndpointFilter] = useState('');
  const [advancedFiltering, setAdvancedFiltering] = useState(false);
  const [showDetailsCard, setShowDetailsCard] = useState(false);
  const [selectedEndpointDetails, setSelectedEndpointDetails] = useState<any>(null);
  
  // Create a local selection state using a Set for efficient lookups
  const [localSelectedKeys, setLocalSelectedKeys] = useState(() => {
    return new Set(selectedEndpoints);
  });
  
  // Sync from context when component mounts
  React.useEffect(() => {
    setLocalSelectedKeys(new Set(selectedEndpoints));
  }, [selectedEndpoints]);
  
  // Sync to context only when unmounting or proceeding to next step
  React.useEffect(() => {
    return () => {
      if (localSelectedKeys.size !== selectedEndpoints.length) {
        setSelectedEndpoints(Array.from(localSelectedKeys));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Update wizard context when user proceeds to next step
  const syncSelectionToContext = useCallback(() => {
    setSelectedEndpoints(Array.from(localSelectedKeys));
  }, [localSelectedKeys, setSelectedEndpoints]);
  
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
  
  // ---- EVENT HANDLERS ----
  
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

  // --- SELECTION HANDLERS (operate on local state) ---
  
  // Toggle a single endpoint's selection
  const handleToggleEndpoint = useCallback((endpoint: any, isSelected: boolean) => {
    const key = `${endpoint.method} ${endpoint.path}`;
    setLocalSelectedKeys(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(key);
      } else {
        newSet.delete(key);
      }
      return newSet;
    });
  }, []);

  // Select all endpoints
  const handleSelectAllEndpoints = useCallback(() => {
    const newSet = new Set<string>();
    endpoints.forEach(endpoint => {
      newSet.add(`${endpoint.method} ${endpoint.path}`);
    });
    setLocalSelectedKeys(newSet);
  }, [endpoints]);

  // Clear all selections
  const handleClearSelection = useCallback(() => {
    setLocalSelectedKeys(new Set());
  }, []);

  // Show details modal for an endpoint
  const handleShowDetails = useCallback((endpoint: any) => {
    setSelectedEndpointDetails(endpoint);
    setShowDetailsCard(true);
  }, []);

  // Close the details modal
  const closeDetailsCard = useCallback(() => {
    setShowDetailsCard(false);
    setSelectedEndpointDetails(null);
  }, []);

  // ---- UI ----
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
            
            {/* This is the CRITICAL component - it's memoized so selection changes don't rerender it */}
            <div className="max-h-64 overflow-y-auto">
              <EndpointList
                endpoints={filteredEndpoints}
                selectedKeys={localSelectedKeys}
                onToggleEndpoint={handleToggleEndpoint}
                onShowDetails={handleShowDetails}
              />
            </div>
          </div>
          
          <div className="mt-2 text-sm text-gray-500">
            {localSelectedKeys.size > 0 ? 
              `Selected ${localSelectedKeys.size} endpoint${localSelectedKeys.size === 1 ? '' : 's'}` : 
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