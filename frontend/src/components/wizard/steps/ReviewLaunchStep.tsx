import { useState, useEffect } from 'react';
import { Play, AlertCircle, CheckCircle, XCircle, Loader, Clock, RefreshCw } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';
import apiService from '../../../services/ApiService';
import { StressTestConfig, StressTestEndpointConfig, TestProgress, SessionStatus } from '../../../types/api';
import { AuthConfig, AuthMethod } from '../WizardContext';

export function ReviewLaunchStep() {
  const {
    baseUrl,
    authJson,
    authConfig,
    selectedEndpoints,
    concurrentRequests,
    distributionMode,
    strategyOptions,
    showAdvancedOptions,
    endpointConfigs,
    setActiveTestId,
    setIsLoading,
    isLoading
  } = useWizard();
  
  const [validationError, setValidationError] = useState<string | null>(null);
  const [testStarted, setTestStarted] = useState(false);
  const [testProgress, setTestProgress] = useState<TestProgress | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [currentTestId, setCurrentTestId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [expandedLevels, setExpandedLevels] = useState<string[]>([]);
  
  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);
  
  // Start polling for progress updates
  const startPolling = (testId: string) => {
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    // Initialize test start time for proper elapsed time calculation
    const testStartTime = Date.now();
    
    // Poll every 1 second
    const interval = setInterval(async () => {
      try {
        // Get general progress
        console.log(`Polling progress for test ${testId}...`);
        const progress = await apiService.getTestProgress(testId);
        console.log('Progress update:', progress);
        
        // Update elapsed time since test start if still running
        if (progress.status === 'running') {
          progress.elapsed_time = (Date.now() - testStartTime) / 1000;
        }
        
        setTestProgress(progress);
        
        // Use auth_sessions from progress response if available
        if (progress.auth_sessions) {
          // Convert to SessionStatus format for compatibility with existing code
          setSessionStatus({
            test_id: testId,
            status: progress.status,
            auth_type: 'session',
            acquired_sessions: progress.auth_sessions
          });
        }
        
        // Fetch test results if available
        if ((progress.status === 'completed' || progress.results_available) && !testResults) {
          try {
            console.log('Fetching full test results...');
            const results = await apiService.getTestResults(testId);
            console.log('Full test results:', results);
            setTestResults(results);
          } catch (error) {
            console.error('Error fetching test results:', error);
          }
        }
        
        // If the test is completed, fetch final results and stop polling
        if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'stopped') {
          try {
            // Fetch final results if we haven't already
            if (!testResults) {
              console.log('Fetching final test results...');
              const results = await apiService.getTestResults(testId);
              console.log('Final test results:', results);
              setTestResults(results);
            }
            
            // Stop polling
            clearInterval(interval);
            setPollingInterval(null);
            console.log('Test completed, polling stopped');
          } catch (error) {
            console.error('Error fetching final test results:', error);
            // Still stop polling even if we couldn't get the results
            clearInterval(interval);
            setPollingInterval(null);
          }
        }
      } catch (error) {
        console.error('Error polling for test progress:', error);
      }
    }, 1000);
    
    // Save the interval ID
    setPollingInterval(interval);
    // Save the test ID
    setCurrentTestId(testId);
  };
  
  // Helper to get auth method display name
  const getAuthMethodDisplayName = (method: AuthMethod): string => {
    switch (method) {
      case 'api_key': return 'API Key';
      case 'bearer_token': return 'Bearer Token';
      case 'basic_auth': return 'Basic Authentication';
      case 'custom_headers': return 'Custom Headers';
      case 'session_cookie': return 'Session Cookie';
      case 'none':
      default: return 'None';
    }
  };
  
  const validateConfig = (): boolean => {
    if (!baseUrl) {
      setValidationError('API Base URL is required');
      return false;
    }
    
    if (selectedEndpoints.length === 0) {
      setValidationError('At least one endpoint must be selected');
      return false;
    }
    
    // Validate authentication based on method
    switch (authConfig.method) {
      case 'api_key':
        if (!authConfig.apiKey?.key || !authConfig.apiKey?.value) {
          setValidationError('API key name and value are required');
          return false;
        }
        break;
        
      case 'bearer_token':
        if (!authConfig.bearerToken) {
          setValidationError('Bearer token is required');
          return false;
        }
        break;
        
      case 'basic_auth':
        if (!authConfig.basicAuth?.username || !authConfig.basicAuth?.password) {
          setValidationError('Username and password are required for Basic Authentication');
          return false;
        }
        break;
        
      case 'session_cookie':
        if (!authConfig.sessionCookie?.loginUrl) {
          setValidationError('Login URL is required for Session Cookie authentication');
          return false;
        }
        if (!authConfig.sessionCookie?.credentials) {
          setValidationError('Login credentials are required for Session Cookie authentication');
          return false;
        }
        break;
        
      case 'custom_headers':
    if (authJson) {
      try {
        JSON.parse(authJson);
      } catch (error) {
        setValidationError('Authentication headers contain invalid JSON');
        return false;
      }
        }
        break;
    }
    
    setValidationError(null);
    return true;
  };
  
  // Add this new function for logging the test configuration
  const logTestConfiguration = () => {
    if (!validateConfig()) {
      return;
    }

    // Prepare headers based on authentication method
    const headers = prepareAuthHeaders();

    // Prepare query parameters for API key in query
    let queryParams = {};
    if (authConfig.method === 'api_key' && authConfig.apiKey?.addTo === 'query' && authConfig.apiKey?.key && authConfig.apiKey?.value) {
      queryParams = { [authConfig.apiKey.key]: authConfig.apiKey.value };
    }

    // Prepare endpoints config
    const configuredEndpoints: StressTestEndpointConfig[] = selectedEndpoints.map(endpointKey => {
      const [method, path] = endpointKey.split(' ');
      const cfg = endpointConfigs[endpointKey] || {};

      const endpointObj: any = {
        method,
        path,
        weight: cfg.weight || 1.0
      };

      // Map optional fields if they exist and use snake_case keys expected by backend
      if ((cfg as any).testDataSamples) {
        endpointObj.test_data_samples = (cfg as any).testDataSamples;
      }
      if ((cfg as any).dataStrategy) {
        endpointObj.data_strategy = (cfg as any).dataStrategy;
      }
      if ((cfg as any).contentType) {
        endpointObj.content_type = (cfg as any).contentType;
      }
      if (typeof (cfg as any).hasBody === 'boolean') {
        endpointObj.has_body = (cfg as any).hasBody;
      }

      return endpointObj as unknown as StressTestEndpointConfig;
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
      query_params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      use_random_session: false
    };

    // Add authentication configurations based on method
    if (authConfig.method === 'session_cookie' && authConfig.sessionCookie) {
      if (authConfig.sessionCookie.multipleAccounts && authConfig.sessionCookie.accountsList?.length) {
        // Multi-account configuration
        testConfig.authentication = {
          type: 'session',
          login_endpoint: authConfig.sessionCookie.loginUrl,
          login_method: authConfig.sessionCookie.method || 'POST',
          multiple_accounts: authConfig.sessionCookie.multipleAccounts,
          accounts: authConfig.sessionCookie.accountsList
        };
      } else {
        // Single account configuration
        testConfig.authentication = {
          type: 'session',
          login_endpoint: authConfig.sessionCookie.loginUrl,
          login_method: authConfig.sessionCookie.method || 'POST',
          login_payload: authConfig.sessionCookie.credentials
        };
      }
    } else if (authConfig.method === 'bearer_token' && authConfig.multipleTokens && authConfig.tokensList?.length) {
      // Multiple bearer tokens configuration
      testConfig.authentication = {
        type: 'token',
        multiple_tokens: true,
        tokens: authConfig.tokensList.filter(token => token.trim() !== '')
      };
    } else if (authConfig.method === 'basic_auth' && authConfig.multipleBasicAuth && authConfig.basicAuthList?.length) {
      // Multiple basic auth credentials configuration
      testConfig.authentication = {
        type: 'basic',
        multiple_accounts: true,
        accounts: authConfig.basicAuthList
          .filter(auth => auth.username.trim() !== '' || auth.password.trim() !== '')
          .map(auth => ({
            username: auth.username,
            password: auth.password
          }))
      };
    }

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

    // Log the configuration to console
    console.log('Test configuration:', JSON.stringify(testConfig, null, 2));
    
    // Also make the actual API call
    sendStressTestRequest(testConfig);
  };
  
  // New function to send the stress test request to the backend
  const sendStressTestRequest = async (config: StressTestConfig) => {
    try {
      setIsLoading(true);
      
      // Prepare the request body
      const requestBody = {
        config: config,
        test_id: null // Let backend generate the ID
      };
      
      // Make the API call
      const response = await fetch('/api/stress-test/task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabaseToken') || ''}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start stress test');
      }
      
      const data = await response.json();
      console.log('Stress test started:', data);
      
      // Update UI to show test is running
      setTestStarted(true);
      setCurrentTestId(data.test_id);
      setActiveTestId(data.test_id);
      
      // Start polling for progress
      startPolling(data.test_id);
      
    } catch (error) {
      console.error('Error starting stress test:', error);
      setValidationError(`Failed to start stress test: ${error instanceof Error ? error.message : String(error)}`);
      setIsLoading(false);
    }
  };
  
  // Prepare authentication headers based on the selected method
  const prepareAuthHeaders = (): Record<string, string> => {
    switch (authConfig.method) {
      case 'api_key':
        if (authConfig.apiKey?.addTo === 'header' && authConfig.apiKey?.key && authConfig.apiKey?.value) {
          return { [authConfig.apiKey.key]: authConfig.apiKey.value };
        }
        return {};
        
      case 'bearer_token':
        // We'll only use the single token here - multiple tokens are handled separately
        if (!authConfig.multipleTokens && authConfig.bearerToken) {
          return { 'Authorization': `Bearer ${authConfig.bearerToken}` };
        }
        return {};
        
      case 'basic_auth':
        // We'll only use the single credential here - multiple credentials are handled separately
        if (!authConfig.multipleBasicAuth && authConfig.basicAuth?.username && authConfig.basicAuth?.password) {
          const base64Credentials = btoa(`${authConfig.basicAuth.username}:${authConfig.basicAuth.password}`);
          return { 'Authorization': `Basic ${base64Credentials}` };
        }
        return {};
        
      case 'custom_headers':
        if (authJson) {
          try {
            return JSON.parse(authJson);
          } catch (error) {
            console.error('Error parsing auth JSON:', error);
          }
        }
        return {};
        
      case 'none':
      default:
        return {};
    }
  };
  
  const startLoadTest = async () => {
    if (!validateConfig()) {
      return;
    }

    setIsLoading(true);
    setTestStarted(true);
    
    try {
      // Prepare headers based on authentication method
      const headers = prepareAuthHeaders();

      // Prepare query parameters for API key in query
      let queryParams = {};
      if (authConfig.method === 'api_key' && authConfig.apiKey?.addTo === 'query' && authConfig.apiKey?.key && authConfig.apiKey?.value) {
        queryParams = { [authConfig.apiKey.key]: authConfig.apiKey.value };
      }

      // Prepare endpoints config
      const configuredEndpoints: StressTestEndpointConfig[] = selectedEndpoints.map(endpointKey => {
        const [method, path] = endpointKey.split(' ');
        const cfg = endpointConfigs[endpointKey] || {};

        const endpointObj: any = {
          method,
          path,
          weight: cfg.weight || 1.0
        };

        // Map optional fields if they exist and use snake_case keys expected by backend
        if ((cfg as any).testDataSamples) {
          endpointObj.test_data_samples = (cfg as any).testDataSamples;
        }
        if ((cfg as any).dataStrategy) {
          endpointObj.data_strategy = (cfg as any).dataStrategy;
        }
        if ((cfg as any).contentType) {
          endpointObj.content_type = (cfg as any).contentType;
        }
        if (typeof (cfg as any).hasBody === 'boolean') {
          endpointObj.has_body = (cfg as any).hasBody;
        }

        return endpointObj as unknown as StressTestEndpointConfig;
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
        query_params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        use_random_session: false
      };

      // Add authentication configurations based on method
      if (authConfig.method === 'session_cookie' && authConfig.sessionCookie) {
        if (authConfig.sessionCookie.multipleAccounts && authConfig.sessionCookie.accountsList?.length) {
          // Multi-account configuration
          testConfig.authentication = {
            type: 'session',
            login_endpoint: authConfig.sessionCookie.loginUrl,
            login_method: authConfig.sessionCookie.method || 'POST',
            multiple_accounts: authConfig.sessionCookie.multipleAccounts,
            accounts: authConfig.sessionCookie.accountsList
          };
        } else {
          // Single account configuration
          testConfig.authentication = {
            type: 'session',
            login_endpoint: authConfig.sessionCookie.loginUrl,
            login_method: authConfig.sessionCookie.method || 'POST',
            login_payload: authConfig.sessionCookie.credentials
          };
        }
      } else if (authConfig.method === 'bearer_token' && authConfig.multipleTokens && authConfig.tokensList?.length) {
        // Multiple bearer tokens configuration
        testConfig.authentication = {
          type: 'token',
          multiple_tokens: true,
          tokens: authConfig.tokensList.filter(token => token.trim() !== '')
        };
      } else if (authConfig.method === 'basic_auth' && authConfig.multipleBasicAuth && authConfig.basicAuthList?.length) {
        // Multiple basic auth credentials configuration
        testConfig.authentication = {
          type: 'basic',
          multiple_accounts: true,
          accounts: authConfig.basicAuthList
            .filter(auth => auth.username.trim() !== '' || auth.password.trim() !== '')
            .map(auth => ({
              username: auth.username,
              password: auth.password
            }))
        };
      }

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
      const testId = response.test_id;
      setCurrentTestId(testId);
      setActiveTestId(testId);
      
      // Start polling for progress updates
      startPolling(testId);
      
      // Keep loading state as true while we poll
    } catch (error) {
      console.error('Error starting load test:', error);
      setValidationError('Failed to start load test. Check console for details.');
      setIsLoading(false);
    }
  };

  // Render session status information
  const renderSessionStatus = () => {
    if (!sessionStatus || sessionStatus.acquired_sessions.length === 0) {
      return (
        <div className="flex items-center p-2 bg-gray-50 rounded text-sm">
          <Clock className="h-4 w-4 text-blue-500 mr-2" />
          <span>Waiting for session information...</span>
        </div>
      );
    }

    return (
      <div>
        {sessionStatus.auth_type === 'session' && sessionStatus.login_endpoint && (
          <div className="text-xs text-gray-500 mb-2 bg-gray-50 p-2 rounded">
            <span className="font-medium">Login endpoint:</span> {sessionStatus.login_endpoint}
          </div>
        )}
        <div className="space-y-2">
          {sessionStatus.acquired_sessions.map((session, index) => {
            const isSuccessful = session.status === 'acquired' || session.status === 'valid';
            const statusColor = isSuccessful ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
            
            return (
              <div key={index} 
                   className={`rounded p-2 border ${statusColor} flex items-start`}>
                {isSuccessful ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                )}
                <div className="text-sm flex-1">
                  {/* Only show account details if there's something meaningful to show */}
                  {(session.account && session.account !== 'user') || 
                   (session.username && session.username !== 'user') || 
                   session.token_id ? (
                    <div className="font-medium">
                      {session.account || session.username || session.token_id || 'API User'}
                    </div>
                  ) : isSuccessful ? (
                    <div className="font-medium">API User</div>
                  ) : (
                    <div className="font-medium">Authentication Failed</div>
                  )}
                  <div className="text-xs text-gray-600 mt-0.5">
                    {isSuccessful ? (
                      <span>
                        {session.status === 'acquired' ? 'Session acquired' : 'Valid credentials'}
                        {session.acquired_at && ` at ${new Date(session.acquired_at).toLocaleTimeString()}`}
                      </span>
                    ) : (
                      <div>
                        <span className="text-red-600 font-medium">
                          Authentication failed
                        </span>
                        {session.error && session.error !== 'Authentication failed' && (
                          <div className="mt-1 text-xs text-gray-600 overflow-x-auto">
                            {session.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {session.session_id && (
                    <div className="text-xs text-gray-500 font-mono mt-1">
                      ID: {session.session_id.substring(0, 12)}...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render progress information
  const renderProgress = () => {
    if (!testProgress) {
      return (
        <div className="flex items-center p-10 justify-center">
          <Loader className="h-5 w-5 text-blue-500 mr-2 animate-spin" />
          <span>Initializing test...</span>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-3 rounded-md border border-gray-100 shadow-sm">
            <div className="text-sm font-medium text-gray-500 mb-1">Status</div>
            <div className="flex items-center">
              {testProgress.status === 'running' ? (
                <>
                  <Loader className="h-4 w-4 text-blue-500 mr-2 animate-spin" />
                  <span className="text-blue-600 font-medium">Running</span>
                </>
              ) : testProgress.status === 'completed' ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span className="text-green-600 font-medium">Completed</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="font-medium capitalize">{testProgress.status}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="bg-white p-3 rounded-md border border-gray-100 shadow-sm">
            <div className="text-sm font-medium text-gray-500 mb-1">Elapsed Time</div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-gray-500 mr-2" />
              <span className="font-medium">
                {testProgress.elapsed_time.toFixed(1)}s
                {testProgress.status === 'completed' && ' (final)'}
              </span>
            </div>
          </div>
        
          <div className="bg-white p-3 rounded-md border border-gray-100 shadow-sm">
            <div className="text-sm font-medium text-gray-500 mb-1">Completed Requests</div>
            <div className="flex items-center">
              <span className="text-lg font-medium">{testProgress.completed_requests.toLocaleString()}</span>
            </div>
          </div>
        </div>
        
        {/* Current Level Indicator */}
        {testProgress.current_level && testProgress.total_levels && (
          <div className="bg-white p-3 rounded-md border border-gray-100 shadow-sm">
            <div className="text-sm font-medium text-gray-500 mb-2">Current Test Level</div>
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">
                  Testing level {testProgress.current_level_index !== undefined ? testProgress.current_level_index + 1 : '?'}/{testProgress.total_levels}
                </span>
                <span className="font-medium">{testProgress.current_level} concurrent requests</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-500 h-2.5 rounded-full" 
                  style={{ 
                    width: `${testProgress.current_level_index !== undefined 
                      ? ((testProgress.current_level_index + 1) / testProgress.total_levels) * 100 
                      : 0}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>
        )}
        
        {/* Session status section - improve title and description */}
        {(authConfig.method !== 'none' && (testProgress.status === 'running' || sessionStatus)) && (
          <div className="bg-white p-3 rounded-md border border-gray-100 shadow-sm">
            <div className="text-sm font-medium text-gray-500 mb-2 flex items-center justify-between">
              <span>API Authentication Details</span>
              <span className="text-xs text-blue-600">{getAuthMethodDisplayName(authConfig.method)}</span>
            </div>
            <div className="text-xs text-gray-500 mb-2">
              Authentication sessions used for concurrent test requests
            </div>
            {renderSessionStatus()}
          </div>
        )}
        
        {/* Concurrency Levels Results - renamed to Test Results */}
        {testProgress.concurrency_levels && Object.keys(testProgress.concurrency_levels).length > 0 && (
          <div className="bg-white p-3 rounded-md border border-gray-100 shadow-sm">
            <div className="text-sm font-medium text-gray-500 mb-2 flex items-center justify-between">
              <span>Test Results</span>
              <span className="text-xs text-gray-500">{Object.keys(testProgress.concurrency_levels).length} concurrency levels tested</span>
            </div>
            <div className="space-y-2">
              {Object.entries(testProgress.concurrency_levels).map(([level, data]) => {
                const isExpanded = expandedLevels.includes(level);
                
                return (
                  <div key={level} className="bg-gray-50 p-2 rounded border border-gray-100 hover:border-gray-200 transition-colors">
                    {/* Header - always visible and clickable */}
                    <div 
                      className="font-medium text-sm flex items-center justify-between cursor-pointer" 
                      onClick={() => toggleLevelExpansion(level)}
                    >
                      <div className="flex items-center">
                        <span>{level} concurrent requests</span>
                        <span className="ml-2 text-xs text-gray-500">
                          {isExpanded ? 'Click to collapse' : 'Click to expand'}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        (data as any).success_rate > 95 ? 'bg-green-100 text-green-800' :
                        (data as any).success_rate > 80 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {(data as any).success_rate !== undefined 
                          ? (data as any).success_rate
                          : Math.round((data as any).successful_requests / (data as any).total_requests * 100)}% success
                      </span>
                    </div>
                    
                    {/* Basic metrics - always visible (restored and improved) */}
                    <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-600">
                      <div>
                        <span className="text-gray-500">Total Requests:</span> 
                        <span className="ml-1 font-medium">
                          {(data as any).total_requests}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Avg Response:</span>
                        <span className="ml-1 font-medium">
                          {((data as any).avg_response_time).toFixed(1)}ms
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Min/Max:</span>
                        <span className="ml-1 font-medium">
                          {((data as any).min_response_time || 0).toFixed(1)}/{((data as any).max_response_time || 0).toFixed(1)}ms
                        </span>
                      </div>
                    </div>
                    
                    {/* Expanded content - only visible when expanded */}
                    {isExpanded && (
                      <div className="mt-3 border-t border-gray-200 pt-2">
                        {/* Title for endpoint breakdown */}
                        <div className="text-xs text-gray-600 mb-2">
                          <span className="font-medium">Endpoint Performance:</span> Testing with {level} concurrent requests using round-robin sequencing
                        </div>
                        
                        {/* Endpoints with detailed metrics */}
                        {(data as any).endpoints && Object.keys((data as any).endpoints).length > 0 && (
                          <div className="space-y-3">
                            {Object.entries((data as any).endpoints).map(([endpoint, epData]) => (
                              <div key={endpoint} className="bg-white p-2 rounded border border-gray-100">
                                <div className="font-medium text-xs flex items-center justify-between">
                                  <span className="font-mono">{endpoint}</span>
                                  <span className={`${
                                    (epData as any).success_rate > 95 ? 'text-green-600' :
                                    (epData as any).success_rate > 80 ? 'text-yellow-600' : 
                                    'text-red-600'
                                  }`}>
                                    {(epData as any).success_rate !== undefined 
                                      ? (epData as any).success_rate 
                                      : Math.round((epData as any).successful / (epData as any).requests * 100)}% success
                                  </span>
                                </div>
                                
                                {/* Detailed endpoint metrics */}
                                <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-600">
                                  <div>
                                    <span className="text-gray-500">Requests:</span> 
                                    <span className="ml-1 font-medium">
                                      {(epData as any).requests}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Avg time:</span>
                                    <span className="ml-1 font-medium">
                                      {((epData as any).avg_response_time).toFixed(1)}ms
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Min/Max:</span>
                                    <span className="ml-1 font-medium">
                                      {((epData as any).min_response_time || 0).toFixed(1)}/{((epData as any).max_response_time || 0).toFixed(1)}ms
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Status code breakdown */}
                                {(epData as any).status_codes && Object.keys((epData as any).status_codes).length > 0 && (
                                  <div className="mt-2">
                                    <div className="text-xs text-gray-500 mb-1">Status Codes:</div>
                                    <div className="flex flex-wrap gap-1">
                                      {Object.entries((epData as any).status_codes).map(([code, count]) => (
                                        <div 
                                          key={code} 
                                          className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${
                                            code.startsWith('2') ? 'bg-green-50 text-green-700' : 
                                            code.startsWith('4') ? 'bg-yellow-50 text-yellow-700' : 
                                            code.startsWith('5') ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'
                                          }`}
                                        >
                                          {code}: {count as number}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Individual request samples */}
                                {(epData as any).requests_data && Object.keys((epData as any).requests_data).length > 0 && (
                                  <div className="mt-2">
                                    <div className="text-xs text-gray-500 mb-1">Sample Responses:</div>
                                    <div className="max-h-40 overflow-y-auto">
                                      {Object.entries((epData as any).requests_data).map(([statusCode, requests]) => {
                                        // Show up to 2 samples per status code
                                        const samples = (requests as any[]).slice(0, 2);
                                        return samples.map((req, idx) => (
                                          <div key={`${statusCode}-${idx}`} className="text-xs bg-gray-50 p-1 rounded mb-1">
                                            <div className="flex justify-between">
                                              <span className={`font-medium ${
                                                statusCode.startsWith('2') ? 'text-green-600' : 
                                                statusCode.startsWith('4') ? 'text-yellow-600' : 
                                                'text-red-600'
                                              }`}>Status {statusCode}</span>
                                              <span>{req.time}ms</span>
                                            </div>
                                            {req.response_body && (
                                              <div className="mt-0.5 font-mono text-[10px] text-gray-600 overflow-x-auto pb-1">
                                                {JSON.stringify(req.response_body).substring(0, 100)}
                                                {JSON.stringify(req.response_body).length > 100 ? '...' : ''}
                                              </div>
                                            )}
                                          </div>
                                        ));
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Test Results Summary - If full results are available */}
        {testResults && (
          <div className="bg-white p-3 rounded-md border border-gray-100 shadow-sm">
            <div className="text-sm font-medium text-gray-500 mb-2">Test Results Summary</div>
            {testResults.summary && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-xs text-gray-500 block mb-1">Success Rate</span>
                    <span className="font-medium">
                      {testResults.summary.successful_requests} / {testResults.summary.total_requests}
                      {testResults.summary.total_requests > 0 && (
                        <span className={`ml-1 ${
                          ((testResults.summary.successful_requests / testResults.summary.total_requests) * 100) > 90 
                            ? 'text-green-600' 
                            : ((testResults.summary.successful_requests / testResults.summary.total_requests) * 100) > 75
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          ({((testResults.summary.successful_requests / testResults.summary.total_requests) * 100).toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-xs text-gray-500 block mb-1">Avg Response Time</span>
                    <span className="font-medium">
                      {testResults.summary.avg_response_time?.toFixed(2) || 0} ms
                    </span>
                  </div>
                </div>
                
                {/* Status Codes */}
                {testResults.summary.status_codes && Object.keys(testResults.summary.status_codes).length > 0 && (
                  <div className="pt-2">
                    <div className="text-xs text-gray-500 mb-1 flex items-center justify-between">
                      <span>Status Codes</span>
                      <span>{Object.keys(testResults.summary.status_codes).length} unique codes</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(testResults.summary.status_codes).map(([code, count]) => (
                        <div 
                          key={code} 
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            code.startsWith('2') ? 'bg-green-100 text-green-800' : 
                            code.startsWith('4') ? 'bg-yellow-100 text-yellow-800' : 
                            code.startsWith('5') ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {code}: {count as number}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };
  
  // Function to toggle expansion state
  const toggleLevelExpansion = (level: string) => {
    if (expandedLevels.includes(level)) {
      setExpandedLevels(expandedLevels.filter(l => l !== level));
    } else {
      setExpandedLevels([...expandedLevels, level]);
    }
  };
  
  return (
    <div className="space-y-6">
      {!testStarted && (
        <>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Review your test configuration and launch the stress test when ready. 
                  The test results will be displayed after you start the test.
                </p>
              </div>
            </div>
          </div>
          
          {validationError && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    {validationError}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-base font-medium text-gray-700">Test Configuration Summary</h3>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700">API Configuration</h4>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <div className="text-sm">
                    <div className="flex items-start">
                      <span className="font-medium w-40">Base URL:</span>
                      <span className="text-gray-800">{baseUrl}</span>
                    </div>
                    <div className="flex items-start mt-2">
                      <span className="font-medium w-40">Authentication:</span>
                      <span className="text-gray-800">{getAuthMethodDisplayName(authConfig.method)}</span>
                    </div>
                    {authConfig.method === 'bearer_token' && authConfig.multipleTokens && (
                      <div className="flex items-start mt-2">
                        <span className="font-medium w-40">Bearer Tokens:</span>
                        <span className="text-gray-800">
                          {authConfig.tokensList?.length || 0} tokens will be used for distributed testing
                        </span>
                      </div>
                    )}
                    {authConfig.method === 'basic_auth' && authConfig.multipleBasicAuth && (
                      <div className="flex items-start mt-2">
                        <span className="font-medium w-40">Basic Auth:</span>
                        <span className="text-gray-800">
                          {authConfig.basicAuthList?.length || 0} credentials will be used for distributed testing
                        </span>
                      </div>
                    )}
                    {authConfig.method === 'session_cookie' && authConfig.sessionCookie?.loginUrl && (
                      <div className="flex items-start mt-2">
                        <span className="font-medium w-40">Login Endpoint:</span>
                        <span className="text-gray-800">{authConfig.sessionCookie.loginUrl}</span>
                      </div>
                    )}
                    {authConfig.method === 'session_cookie' && authConfig.sessionCookie?.multipleAccounts && (
                      <div className="flex items-start mt-2">
                        <span className="font-medium w-40">Test Accounts:</span>
                        <span className="text-gray-800">
                          {authConfig.sessionCookie.accountsList?.length || 0} accounts will be used for distributed testing
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700">Endpoints ({selectedEndpoints.length})</h4>
                <div className="mt-1 p-3 bg-gray-50 rounded-md max-h-80 overflow-y-auto">
                  <ul className="text-sm space-y-3">
                    {selectedEndpoints.map((endpoint, index) => {
                      const [method, path] = endpoint.split(' ');
                      const config = endpointConfigs[endpoint] || {};
                      // @ts-ignore - testData property exists at runtime but not in type definition
                      const testData = config.testData || [];
                      
                      return (
                        <li key={index} className="border-b border-gray-200 dark:border-gray-700 pb-3 last:border-0 last:pb-0">
                          <div className="flex items-center mb-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              method === 'GET' 
                                ? 'bg-blue-100 text-blue-800' 
                                : method === 'POST'
                                ? 'bg-green-100 text-green-800'
                                : method === 'PUT'
                                ? 'bg-yellow-100 text-yellow-800'
                                : method === 'DELETE'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {method}
                            </span>
                            <span className="ml-2 text-gray-800 font-medium">{path}</span>
                          </div>
                          
                          {testData && testData.length > 0 ? (
                            <div>
                              <div className="text-xs text-gray-500 mb-1.5">
                                {testData.length === 1 ? '1 test data sample configured' : `${testData.length} test data samples configured`}
                              </div>
                              <div className="pl-4 border-l-2 border-blue-200">
                                {testData.slice(0, 1).map((dataset: any, i: number) => (
                                  <div key={i} className="text-xs">
                                    <div className="font-medium text-blue-600">{dataset.name || `Sample ${i+1}`}</div>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                      {Object.keys(dataset.data.path_params || {}).length > 0 && (
                                        <div>
                                          <span className="text-xs text-gray-500">Path Parameters:</span>
                                          {Object.entries(dataset.data.path_params).slice(0, 2).map(([key, value]) => (
                                            <div key={key} className="text-gray-600 font-mono text-xs">
                                              {key}: {JSON.stringify(value).substring(0, 20)}
                                            </div>
                                          ))}
                                          {Object.keys(dataset.data.path_params).length > 2 && (
                                            <div className="text-gray-400">+ {Object.keys(dataset.data.path_params).length - 2} more</div>
                                          )}
                                        </div>
                                      )}
                                      
                                      {Object.keys(dataset.data.request_body || {}).length > 0 && (
                                        <div>
                                          <span className="text-xs text-gray-500">Request Body:</span>
                                          <div className="text-gray-600 font-mono text-xs truncate max-w-[200px]">
                                            {JSON.stringify(dataset.data.request_body).substring(0, 60)}
                                            {JSON.stringify(dataset.data.request_body).length > 60 ? '...' : ''}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {testData.length > 1 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    + {testData.length - 1} more samples
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-yellow-600">
                              No test data configured
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700">Load Configuration</h4>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <div className="text-sm space-y-2">
                    <div className="flex items-start">
                      <span className="font-medium w-40">Concurrent Requests:</span>
                      <span className="text-gray-800">{concurrentRequests}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="font-medium w-40">Distribution Strategy:</span>
                      <span className="text-gray-800">
                        {distributionMode === 'sequential' && 'Sequential'}
                        {distributionMode === 'interleaved' && 'Interleaved'}
                        {distributionMode === 'random' && 'Random'}
                        {!['sequential', 'interleaved', 'random'].includes(distributionMode) && 
                          distributionMode.charAt(0).toUpperCase() + distributionMode.slice(1)}
                      </span>
                    </div>
                    
                    {showAdvancedOptions && (
                      <div className="pt-2">
                        <span className="font-medium">Advanced Options:</span>
                        
                        {distributionMode === 'sequential' && (
                          <div className="pl-4 mt-1 space-y-1">
                            <div>Delay between requests: {strategyOptions[distributionMode].sequential_delay} ms</div>
                            <div>Repeat count: {strategyOptions[distributionMode].sequential_repeat}</div>
                          </div>
                        )}
                        
                        {distributionMode === 'random' && (
                          <div className="pl-4 mt-1 space-y-1">
                            <div>Seed: {strategyOptions[distributionMode].random_seed || 'Random'}</div>
                            <div>Distribution pattern: {strategyOptions[distributionMode].random_distribution_pattern}</div>
                          </div>
                        )}
                        
                        {distributionMode === 'interleaved' && Object.keys(strategyOptions[distributionMode]?.endpoint_distribution || {}).length > 0 && (
                          <div className="pl-4 mt-1">
                            <div>Custom endpoint distribution configured</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
      {testStarted && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-base font-medium text-gray-700">Test Progress</h3>
          </div>
          
          <div className="p-4">
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {renderProgress()}
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-center pt-4">
        {!testStarted ? (
          <Button
            onClick={logTestConfiguration}
            disabled={isLoading}
            className="flex items-center py-2 px-8 shadow-sm"
            size="lg"
          >
            <Play className="h-5 w-5 mr-2" />
            {isLoading ? 'Starting...' : 'START STRESS TEST'}
          </Button>
        ) : (
          <div className="flex space-x-3">
            {testProgress && testProgress.status === 'running' ? (
              <Button
                onClick={() => window.location.reload()}
                className="flex items-center py-2 px-6 bg-gray-600 hover:bg-gray-700"
                size="lg"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                RESTART TEST
              </Button>
            ) : (
              <Button
                onClick={() => window.location.reload()}
                className="flex items-center py-2 px-6 bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                RUN NEW TEST
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 