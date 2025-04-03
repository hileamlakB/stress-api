import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Settings, LogOut, Play, RefreshCw, Link, Plus, Minus, Check, ChevronDown, ChevronUp, Filter, Tag } from 'lucide-react';
import { Button } from '../components/Button';
import { signOut, getCurrentUser } from '../lib/auth';
import { MetricsPanel } from '../components/MetricsPanel';
import { DemoMetricsPanel } from '../components/DemoMetricsPanel';
import { SessionSidebar, Session } from '../components/SessionSidebar';
import apiService from '../services/ApiService';
import { DistributionStrategy, StressTestConfig, DistributionRequirementsResponse, StressTestEndpointConfig } from '../types/api';
import { EndpointsList } from '../components/endpoints/EndpointsList';

// Define types for our state
type Endpoint = {
  method: string;
  path: string;
  description?: string;
  // Adding these properties to make Endpoint compatible with EndpointSchema
  summary: string;
  parameters: Array<any>;
  responses: Record<string, any>;
};

export function Dashboard() {
  // Base configuration state
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [showAuthConfig, setShowAuthConfig] = useState(false);
  
  // Section expansion states
  const [configSectionExpanded, setConfigSectionExpanded] = useState(true);
  const [endpointsSectionExpanded, setEndpointsSectionExpanded] = useState(true);
  const [dataGenSectionExpanded, setDataGenSectionExpanded] = useState(true);
  const [testConfigSectionExpanded, setTestConfigSectionExpanded] = useState(true);
  
  // Authentication state
  const [authJson, setAuthJson] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Endpoints state
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([]);
  const [endpointFilter, setEndpointFilter] = useState('');
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(false);
  
  // New endpoint filtering and organization state
  const [activeTab, setActiveTab] = useState<string>('all');
  const [filterByMethod, setFilterByMethod] = useState<string>('all');
  const [advancedFiltering, setAdvancedFiltering] = useState(false);
  
  // Test configuration state
  const [concurrentRequests, setConcurrentRequests] = useState(10);
  const [distributionMode, setDistributionMode] = useState<DistributionStrategy>('sequential');
  const [availableStrategies, setAvailableStrategies] = useState<string[]>([]);
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(false);
  
  // New state for strategy requirements
  const [strategyRequirements, setStrategyRequirements] = useState<DistributionRequirementsResponse | null>(null);
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(false);
  
  // Show loading indicator when requirements are being fetched
  const isLoading = isLoadingEndpoints || isLoadingStrategies || isLoadingRequirements;
  
  // Dynamic strategy options - will be populated based on requirements
  const [strategyOptions, setStrategyOptions] = useState<Record<string, any>>({
    sequential: { 
      sequential_delay: 100, 
      sequential_repeat: 1
    },
    interleaved: { 
      endpoint_distribution: {} 
    },
    random: { 
      random_seed: undefined, 
      random_distribution_pattern: 'uniform' 
    }
  });
  
  // Advanced options toggle
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Session state
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  
  // User state
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  
  // New state for endpoint configurations
  const [endpointConfigs, setEndpointConfigs] = useState<Record<string, StressTestEndpointConfig>>({});
  
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    fetchDistributionStrategies();
    fetchDistributionRequirements();
  }, []);

  // Initialize default options when requirements change or distribution mode changes
  useEffect(() => {
    if (strategyRequirements && distributionMode) {
      const requirements = strategyRequirements.strategies[distributionMode];
      if (requirements) {
        // Initialize default values for general requirements
        const defaults: Record<string, any> = {};
        
        Object.entries(requirements.general_requirements).forEach(([key, field]) => {
          defaults[key] = field.default_value;
        });
        
        // For endpoint-specific requirements, initialize with even distribution if needed
        if (requirements.endpoint_specific_requirements && 
            requirements.endpoint_requirements?.type === 'percentage' &&
            selectedEndpoints.length > 0) {
          const evenValue = Math.floor(100 / selectedEndpoints.length);
          const remainder = 100 % selectedEndpoints.length;
          
          const distribution = selectedEndpoints.reduce((acc, endpoint, index) => {
            acc[endpoint] = evenValue + (index < remainder ? 1 : 0);
            return acc;
          }, {} as Record<string, number>);
          
          defaults.endpoint_distribution = distribution;
        }
        
        setStrategyOptions(prevOptions => ({
          ...prevOptions,
          [distributionMode]: {
            ...prevOptions[distributionMode],
            ...defaults
          }
        }));
      }
    }
  }, [strategyRequirements, distributionMode, selectedEndpoints]);

  const checkAuth = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        navigate('/login');
      } else {
        // Store the user's email
        setCurrentUserEmail(user.email || null);
      }
    } catch (error) {
      navigate('/login');
    }
  };

  const fetchDistributionStrategies = async () => {
    try {
      setIsLoadingStrategies(true);
      const strategies = await apiService.fetchDistributionStrategies();
      setAvailableStrategies(strategies);
      // Set default strategy if none is set and we have strategies available
      if (strategies.length > 0 && !distributionMode) {
        setDistributionMode(strategies[0] as DistributionStrategy);
      }
    } catch (error) {
      console.error('Error fetching distribution strategies:', error);
      // Fallback to default hardcoded values in case of error
      setAvailableStrategies(['sequential', 'interleaved', 'random']);
    } finally {
      setIsLoadingStrategies(false);
    }
  };

  const fetchDistributionRequirements = async () => {
    try {
      setIsLoadingRequirements(true);
      const requirements = await apiService.fetchDistributionRequirements();
      setStrategyRequirements(requirements);
    } catch (error) {
      console.error('Error fetching distribution requirements:', error);
      // Don't set fallback values here, as they would be complex to define
    } finally {
      setIsLoadingRequirements(false);
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

  const handleSessionSelect = (session: Session) => {
    setSelectedSession(session);
    console.log('Selected session:', session);
    
    // Use the selected session's configuration to populate the form
    if (session && session.configurations && session.configurations.length > 0) {
      const config = session.configurations[0]; // Use the first configuration
      console.log('Session configuration:', config);
      
      // Check if we have success_criteria with TestConfigRequest data
      if (config.success_criteria && config.success_criteria.target_url) {
        const testConfig = config.success_criteria;
        console.log('Using test config from success_criteria:', testConfig);
        
        // Set the base URL from the test configuration
        setBaseUrl(testConfig.target_url);
        
        // Set concurrent users
        setConcurrentRequests(testConfig.concurrent_users);
        
        // Set selected endpoints if available
        if (testConfig.endpoints && Array.isArray(testConfig.endpoints)) {
          setSelectedEndpoints(testConfig.endpoints);
          
          // Also populate the endpoints list if it's empty
          if (endpoints.length === 0) {
            const mappedEndpoints: Endpoint[] = testConfig.endpoints.map((endpoint: string) => {
              const [method, path] = endpoint.split(' ');
              return {
                method,
                path,
                description: '',
                summary: '',
                parameters: [],
                responses: {}
              };
            });
            setEndpoints(mappedEndpoints);
          }
        }
        
        // Set auth headers if available
        if (testConfig.headers) {
          setAuthJson(JSON.stringify(testConfig.headers, null, 2));
          setShowAuthConfig(Object.keys(testConfig.headers).length > 0);
        }
      } else {
        // Fall back to the old behavior
        setBaseUrl(config.endpoint_url);
        setConcurrentRequests(config.concurrent_users);
      }
      
      console.log(`Loaded configuration with ${session.configurations.length} endpoints`);
    }
  };

  const fetchEndpoints = async () => {
    if (!baseUrl) {
      alert('Please enter a FastAPI Base URL');
      return;
    }

    // Clean up the URL
    let cleanUrl = baseUrl.trim();
    // Ensure the URL has a protocol
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    // Set the cleaned URL
    setBaseUrl(cleanUrl);

    setIsLoadingEndpoints(true);
    setEndpoints([]); // Clear any previous endpoints
    
    try {
      // Show user feedback about the process
      console.log(`Fetching endpoints from: ${cleanUrl}`);

      // Call the backend API to fetch endpoints
      const endpointData = await apiService.fetchEndpoints(cleanUrl);
      
      // Map the endpoint data to our simplified format
      const mappedEndpoints: Endpoint[] = endpointData.map(endpoint => ({
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
    } catch (error) {
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

  // Group endpoints into tabs based on URL patterns
  const endpointGroups = useMemo(() => {
    // Start with the "all" group
    const groups: Record<string, Endpoint[]> = { all: endpoints };
    
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

  // Get unique methods from endpoints for the method filter dropdown
  const availableMethods = useMemo(() => {
    const methods = new Set<string>();
    endpoints.forEach(ep => methods.add(ep.method));
    return ['all', ...Array.from(methods)];
  }, [endpoints]);

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

      // Prepare endpoints config, now using our data generation configurations if available
      const configuredEndpoints: StressTestEndpointConfig[] = selectedEndpoints.map(endpoint => {
        const [method, path] = endpoint.split(' ');
        
        // Use the endpoint configuration if it exists
        const config: StressTestEndpointConfig = endpointConfigs[endpoint] || {
          method,
          path,
          weight: 1.0
        };
        
        return config;
      });

      // Create test config
      const testConfig: StressTestConfig = {
        target_url: baseUrl,
        strategy: distributionMode,
        max_concurrent_users: concurrentRequests,
        request_rate: 10,  // Default value
        duration: 60,      // Default value
        endpoints: configuredEndpoints,
        headers,
        use_random_session: false
      };

      // Add strategy-specific options to the test config
      if (showAdvancedOptions) {
        testConfig.strategy_options = {};
        
        switch (distributionMode) {
          case 'sequential':
            testConfig.strategy_options.sequential = {
              delay_between_requests_ms: strategyOptions[distributionMode].sequential_delay,
              repeat_sequence: strategyOptions[distributionMode].sequential_repeat
            };
            break;
          case 'interleaved':
            testConfig.strategy_options.interleaved = {
              endpoint_distribution: strategyOptions[distributionMode].endpoint_distribution
            };
            break;
          case 'random':
            testConfig.strategy_options.random = {
              seed: strategyOptions[distributionMode].random_seed,
              distribution_pattern: strategyOptions[distributionMode].random_distribution_pattern
            };
            break;
          default:
            console.error(`Unsupported distribution strategy: ${distributionMode}`);
            return;
        }
      }

      // Call the actual API to start the stress test
      const response = await apiService.startStressTest(testConfig);
      setActiveTestId(response.test_id);
      setLoading(false);
    } catch (error) {
      console.error('Error starting load test:', error);
      alert('Failed to start load test');
      setLoading(false);
    }
  };

  // Handle endpoint configuration changes
  const handleEndpointConfigChange = (configs: Record<string, StressTestEndpointConfig>) => {
    setEndpointConfigs(configs);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Zap className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold">FastAPI Stress Tester 🚀</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {}}
                className="flex items-center"
              >
                <Settings className="h-5 w-5 mr-1" />
                Settings
              </Button>
              <Button
                variant="outline"
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

      <div className="flex flex-1 overflow-hidden">
        {/* Session Sidebar */}
        <SessionSidebar 
          onSessionSelect={handleSessionSelect}
          selectedSessionId={selectedSession?.id}
          userEmail={currentUserEmail}
        />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex justify-center items-center h-full">
              <div className="flex flex-col items-center">
                <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin" />
                <p className="mt-4 text-gray-600">Loading...</p>
              </div>
            </div>
          )}
          
          {!isLoading && (
            <>
              <div className="bg-white rounded-lg shadow mb-8">
                {/* API Configuration Section Header */}
                <div 
                  className="p-4 border-b border-gray-200 flex justify-between items-center cursor-pointer"
                  onClick={() => setConfigSectionExpanded(!configSectionExpanded)}
                >
                  <h3 className="text-lg font-medium text-gray-900">API Configuration</h3>
                  <div className="text-gray-500">
                    {configSectionExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
                
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    configSectionExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="p-6">
                    {/* Add instructional text */}
                    <p className="text-sm text-gray-600 mb-4">
                      Start by entering the base URL of your FastAPI application. This should include the protocol (http/https), domain, and port if needed.
                    </p>
                    <div className="space-y-6">
                      <div>
                        <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 mb-1">
                          API Base URL
                        </label>
                        <div className="flex">
                          <input
                            id="baseUrl"
                            type="text"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="https://your-api.com"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Example: http://localhost:8000 or https://api.example.com
                        </p>
                      </div>
                      
                      <div>
                        <div className="flex items-center">
                          <Button
                            variant="outline"
                            onClick={() => setShowAuthConfig(!showAuthConfig)}
                            className="flex items-center"
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            {showAuthConfig ? 'Hide Authentication' : 'Configure Authentication'}
                          </Button>
                        </div>
                        
                        {showAuthConfig && (
                          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                            {/* Add instructional text */}
                            <p className="text-sm text-gray-600 mb-3">
                              Specify authentication headers as a JSON object. These will be included with every request during load testing.
                            </p>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Authentication Headers (JSON)
                            </label>
                            <textarea
                              value={authJson}
                              onChange={(e) => {
                                setAuthJson(e.target.value);
                                validateAuthJson(e.target.value);
                              }}
                              rows={5}
                              placeholder='{"Authorization": "Bearer YOUR_TOKEN_HERE"}'
                              className={`w-full px-4 py-2 border ${
                                authError ? 'border-red-300' : 'border-gray-300'
                              } rounded-md focus:outline-none focus:ring-2 ${
                                authError ? 'focus:ring-red-500' : 'focus:ring-indigo-500'
                              }`}
                            />
                            {authError && (
                              <p className="mt-1 text-xs text-red-500">{authError}</p>
                            )}
                            <p className="mt-1 text-xs text-gray-500">
                              Example: {"{"}"Authorization": "Bearer eyJhbGciOiJ..."{"}"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Available Endpoints Section */}
              <div className="bg-white rounded-lg shadow mb-8">
                <div 
                  className="p-4 border-b border-gray-200 flex justify-between items-center cursor-pointer"
                  onClick={() => setEndpointsSectionExpanded(!endpointsSectionExpanded)}
                >
                  <div className="flex justify-between items-center w-full">
                    <h3 className="text-lg font-medium text-gray-900">Available Endpoints</h3>
                    <div className="flex items-center">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchEndpoints();
                        }}
                        disabled={isLoadingEndpoints || !baseUrl}
                        className="flex items-center mr-4"
                        size="sm"
                      >
                        {isLoadingEndpoints ? (
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-1" />
                        )}
                        Fetch Endpoints
                      </Button>
                      {endpointsSectionExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>
                
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    endpointsSectionExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="p-6">
                    {/* Add instructional text */}
                    <p className="text-sm text-gray-600 mb-4">
                      Select the endpoints you want to include in your load test. You can filter, select all, or choose specific endpoints to test.
                    </p>
                    {endpoints.length > 0 && (
                      <>
                        <div className="flex flex-col mb-4">
                          {/* Filtering controls */}
                          <div className="flex mb-2 items-center">
                            <div className="relative flex-1">
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
                            <div className="ml-4 space-x-2">
                              <Button size="sm" onClick={handleSelectAllEndpoints}>
                                Select All
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleClearSelection}>
                                Clear Selection
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => setAdvancedFiltering(!advancedFiltering)}
                                className="flex items-center"
                              >
                                <Filter className="h-4 w-4 mr-1" />
                                {advancedFiltering ? 'Hide Filters' : 'More Filters'}
                              </Button>
                            </div>
                          </div>

                          {/* Advanced filtering options */}
                          {advancedFiltering && (
                            <div className="flex items-center mt-2 mb-2 space-x-4">
                              <div className="flex items-center">
                                <label htmlFor="methodFilter" className="block text-sm font-medium text-gray-700 mr-2">
                                  Method:
                                </label>
                                <select
                                  id="methodFilter"
                                  value={filterByMethod}
                                  onChange={(e) => setFilterByMethod(e.target.value)}
                                  className="text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 py-1 px-2"
                                >
                                  {availableMethods.map(method => (
                                    <option key={method} value={method}>
                                      {method === 'all' ? 'All Methods' : method}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-center ml-4">
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
                </div>
              </div>

              {/* Data Generation Configuration Section */}
              {selectedEndpoints.length > 0 && (
                <div className="bg-white rounded-lg shadow mb-8">
                  <div 
                    className="p-4 border-b border-gray-200 flex justify-between items-center cursor-pointer"
                    onClick={() => setDataGenSectionExpanded(!dataGenSectionExpanded)}
                  >
                    <h3 className="text-lg font-medium text-gray-900">Data Generation Configuration</h3>
                    <div className="text-gray-500">
                      {dataGenSectionExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                  
                  <div 
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      dataGenSectionExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="p-6">
                      {/* Add instructional text */}
                      <p className="text-sm text-gray-600 mb-4">
                        Configure the request body and parameters for each selected endpoint. This will define the data sent during the load test.
                      </p>
                      <EndpointsList
                        selectedEndpoints={selectedEndpoints}
                        endpointsData={endpoints}
                        onEndpointConfigChange={handleEndpointConfigChange}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Test Configuration Section */}
              <div className="bg-white rounded-lg shadow mb-8">
                <div 
                  className="p-4 border-b border-gray-200 flex justify-between items-center cursor-pointer"
                  onClick={() => setTestConfigSectionExpanded(!testConfigSectionExpanded)}
                >
                  <h3 className="text-lg font-medium text-gray-900">Test Configuration</h3>
                  <div className="text-gray-500">
                    {testConfigSectionExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
                
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    testConfigSectionExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="p-6">
                    {/* Add instructional text */}
                    <p className="text-sm text-gray-600 mb-4">
                      Adjust the stress test parameters below to define how requests will be distributed and executed during testing.
                    </p>
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
                          onChange={(e) => setConcurrentRequests(parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Controls how many requests will run simultaneously. Higher values create more server load.
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Distribution Strategy</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Select how requests should be distributed across your endpoints. Each strategy creates different load patterns.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {isLoadingStrategies ? (
                            <div className="col-span-3 py-4 text-center text-sm text-gray-500">
                              Loading distribution strategies...
                            </div>
                          ) : availableStrategies.length === 0 ? (
                            <div className="col-span-3 py-4 text-center text-sm text-gray-500">
                              No distribution strategies available.
                            </div>
                          ) : (
                            availableStrategies.map((strategy) => (
                              <div
                                key={strategy}
                                onClick={() => setDistributionMode(strategy as DistributionStrategy)}
                                className={`border ${
                                  distributionMode === strategy 
                                    ? 'border-indigo-500 bg-indigo-50' 
                                    : 'border-gray-200 hover:bg-gray-50'
                                } rounded-lg p-3 cursor-pointer transition-colors`}
                              >
                                <div className="flex items-center mb-1">
                                  <input
                                    type="radio"
                                    checked={distributionMode === strategy}
                                    readOnly
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="text-sm font-medium text-gray-900 ml-2">
                                    {strategy === 'sequential' && 'Sequential testing'}
                                    {strategy === 'interleaved' && 'Interleaved testing'}
                                    {strategy === 'random' && 'Random distribution'}
                                    {!['sequential', 'interleaved', 'random'].includes(strategy) && 
                                      strategy.charAt(0).toUpperCase() + strategy.slice(1)}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500">
                                  {strategy === 'sequential' && 'Requests are sent one after another in order'}
                                  {strategy === 'interleaved' && 'Requests are distributed evenly across endpoints'}
                                  {strategy === 'random' && 'Requests are sent randomly to selected endpoints'}
                                  {!['sequential', 'interleaved', 'random'].includes(strategy) && 
                                    `Custom distribution strategy: ${strategy}`}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      
                      {/* Advanced options toggle */}
                      <div className="flex items-center">
                        <input
                          id="showAdvancedOptions"
                          type="checkbox"
                          checked={showAdvancedOptions}
                          onChange={() => setShowAdvancedOptions(!showAdvancedOptions)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="showAdvancedOptions" className="ml-2 block text-sm text-gray-700">
                          Show advanced distribution options
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-6">
                        Advanced options allow fine-tuning of request timing, distribution percentages, and randomization parameters.
                      </p>
                      
                      {/* Strategy-specific options */}
                      {showAdvancedOptions && distributionMode === 'sequential' && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Sequential Options</h4>
                          <p className="text-sm text-gray-600 mb-3">
                            Configure how sequential requests are executed, including delays between requests and repetition count.
                          </p>
                          <div className="space-y-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Delay between requests (ms)
                              </label>
                              <input
                                type="number"
                                value={strategyOptions[distributionMode].sequential_delay}
                                onChange={(e) => {
                                  setStrategyOptions(prevOptions => ({
                                    ...prevOptions,
                                    [distributionMode]: {
                                      ...prevOptions[distributionMode],
                                      sequential_delay: parseInt(e.target.value, 10)
                                    }
                                  }));
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Repeat count
                              </label>
                              <input
                                type="number"
                                value={strategyOptions[distributionMode].sequential_repeat}
                                onChange={(e) => {
                                  setStrategyOptions(prevOptions => ({
                                    ...prevOptions,
                                    [distributionMode]: {
                                      ...prevOptions[distributionMode],
                                      sequential_repeat: parseInt(e.target.value, 10)
                                    }
                                  }));
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {showAdvancedOptions && distributionMode === 'interleaved' && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Endpoint Distribution</h4>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="text-sm text-gray-700 mb-4">
                              Set the percentage of requests for each endpoint. Total must equal 100%.
                            </p>
                            {selectedEndpoints.length > 0 && (
                              <div className="space-y-4">
                                {selectedEndpoints.map((endpoint, index) => {
                                  const currentValue = strategyOptions[distributionMode]?.endpoint_distribution[endpoint] || 
                                    Math.floor(100 / selectedEndpoints.length);
                                  
                                  return (
                                    <div key={index} className="flex items-center space-x-2">
                                      <div className="w-32 flex-shrink-0">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                          endpoint.split(' ')[0] === 'GET' 
                                            ? 'bg-blue-100 text-blue-800' 
                                            : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                          {endpoint.split(' ')[0]}
                                        </span>
                                      </div>
                                      <div className="flex-grow text-sm truncate" title={endpoint.split(' ')[1]}>
                                        {endpoint.split(' ')[1]}
                                      </div>
                                      <div className="flex items-center">
                                        <button
                                          onClick={() => {
                                            const newValue = Math.max(0, currentValue - 1);
                                            setStrategyOptions(prevOptions => ({
                                              ...prevOptions,
                                              [distributionMode]: {
                                                ...prevOptions[distributionMode],
                                                endpoint_distribution: {
                                                  ...prevOptions[distributionMode].endpoint_distribution,
                                                  [endpoint]: newValue
                                                }
                                              }
                                            }));
                                          }}
                                          className="p-1 rounded-md text-gray-500 hover:bg-gray-200"
                                        >
                                          <Minus className="h-4 w-4" />
                                        </button>
                                        <input 
                                          type="number"
                                          value={currentValue}
                                          onChange={(e) => {
                                            const newValue = parseInt(e.target.value, 10);
                                            if (!isNaN(newValue) && newValue >= 0) {
                                              setStrategyOptions(prevOptions => ({
                                                ...prevOptions,
                                                [distributionMode]: {
                                                  ...prevOptions[distributionMode],
                                                  endpoint_distribution: {
                                                    ...prevOptions[distributionMode].endpoint_distribution,
                                                    [endpoint]: newValue
                                                  }
                                                }
                                              }));
                                            }
                                          }}
                                          className="w-14 p-1 mx-1 text-center border border-gray-300 rounded-md"
                                        />
                                        <button
                                          onClick={() => {
                                            const newValue = currentValue + 1;
                                            setStrategyOptions(prevOptions => ({
                                              ...prevOptions,
                                              [distributionMode]: {
                                                ...prevOptions[distributionMode],
                                                endpoint_distribution: {
                                                  ...prevOptions[distributionMode].endpoint_distribution,
                                                  [endpoint]: newValue
                                                }
                                              }
                                            }));
                                          }}
                                          className="p-1 rounded-md text-gray-500 hover:bg-gray-200"
                                        >
                                          <Plus className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                                
                                {/* Display total distribution percentage */}
                                <div className="border-t border-gray-200 pt-3 mt-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">Total distribution:</span>
                                    <span className={`text-sm font-medium ${
                                      Object.values(strategyOptions[distributionMode]?.endpoint_distribution || {})
                                        .map(Number)
                                        .reduce((sum, val) => sum + val, 0) === 100
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }`}>
                                      {Object.values(strategyOptions[distributionMode]?.endpoint_distribution || {})
                                        .map(Number)
                                        .reduce((sum, val) => sum + val, 0)}% 
                                      {Object.values(strategyOptions[distributionMode]?.endpoint_distribution || {})
                                        .map(Number)
                                        .reduce((sum, val) => sum + val, 0) === 100 && 
                                        <Check className="inline ml-1 h-4 w-4" />}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Even distribution button */}
                                <div className="mt-3">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      const evenValue = Math.floor(100 / selectedEndpoints.length);
                                      const remainder = 100 % selectedEndpoints.length;
                                      
                                      const newDistribution = selectedEndpoints.reduce((acc, endpoint, index) => {
                                        acc[endpoint] = evenValue + (index < remainder ? 1 : 0);
                                        return acc;
                                      }, {} as Record<string, number>);
                                      
                                      setStrategyOptions(prevOptions => ({
                                        ...prevOptions,
                                        [distributionMode]: {
                                          ...prevOptions[distributionMode],
                                          endpoint_distribution: newDistribution
                                        }
                                      }));
                                    }}
                                  >
                                    Set Even Distribution
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {selectedEndpoints.length === 0 && (
                              <div className="text-center p-4">
                                <p className="text-sm text-gray-500">
                                  Select endpoints to configure distribution percentages
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {showAdvancedOptions && distributionMode === 'random' && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Random Options</h4>
                          <p className="text-sm text-gray-600 mb-3">
                            Configure randomization parameters to control how requests are distributed across endpoints.
                          </p>
                          <div className="space-y-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Seed (optional)
                              </label>
                              <input
                                type="number"
                                value={strategyOptions[distributionMode].random_seed || ''}
                                onChange={(e) => {
                                  const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
                                  setStrategyOptions(prevOptions => ({
                                    ...prevOptions,
                                    [distributionMode]: {
                                      ...prevOptions[distributionMode],
                                      random_seed: value
                                    }
                                  }));
                                }}
                                placeholder="Random seed for reproducibility"
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Distribution pattern
                              </label>
                              <select
                                value={strategyOptions[distributionMode].random_distribution_pattern}
                                onChange={(e) => {
                                  setStrategyOptions(prevOptions => ({
                                    ...prevOptions,
                                    [distributionMode]: {
                                      ...prevOptions[distributionMode],
                                      random_distribution_pattern: e.target.value as 'uniform' | 'weighted' | 'gaussian'
                                    }
                                  }));
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="uniform">Uniform (equal probability)</option>
                                <option value="weighted">Weighted (by endpoint weight)</option>
                                <option value="gaussian">Gaussian (normal distribution)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Run Stress Test Button */}
              <div className="bg-white rounded-lg shadow p-6 mb-8 flex justify-end">
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}