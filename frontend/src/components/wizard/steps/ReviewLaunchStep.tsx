import { useState, useEffect } from 'react';
import { Play, AlertCircle, CheckCircle, XCircle, Loader, Clock, RefreshCw } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';
import apiService from '../../../services/ApiService';
import { StressTestConfig, StressTestEndpointConfig, TestProgress, SessionStatus } from '../../../types/api';
import { AuthConfig, AuthMethod } from '../WizardContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../Dialog';

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
  const [currentTestId, setCurrentTestId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [testProgress, setTestProgress] = useState<TestProgress | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  
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
    
    // Poll every 2 seconds
    const interval = setInterval(async () => {
      try {
        // Get general progress
        const progress = await apiService.getTestProgress(testId);
        setTestProgress(progress);
        
        // Get session status
        const sessionInfo = await apiService.getSessionStatus(testId);
        setSessionStatus(sessionInfo);
        
        // Stop polling if test is complete
        if (progress.status === 'completed' || progress.status === 'stopped') {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
        }
      } catch (error) {
        console.error('Error polling test progress:', error);
      }
    }, 2000);
    
    setPollingInterval(interval);
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
    
    // Generate a mock test ID
    const mockTestId = `demo-${Date.now()}`;
    setCurrentTestId(mockTestId);
    setActiveTestId(mockTestId);
    
    // Create mock test progress
    setTestProgress({
      status: 'running',
      elapsed_time: 0,
      completed_requests: 0,
      total_requests: 100,
      errors: 0
    });
    
    // Create mock session status for display
    if (authConfig.method !== 'none') {
      setSessionStatus({
        auth_type: authConfig.method === 'session_cookie' ? 'session' : 'token',
        login_endpoint: authConfig.method === 'session_cookie' ? authConfig.sessionCookie?.loginUrl || '' : '',
        acquired_sessions: [
          {
            status: 'acquired',
            account: 'demo-user@example.com',
            acquired_at: new Date().toISOString(),
            session_id: `session-${Date.now()}`
          }
        ]
      });
    }
    
    // Simulate progress updates
    let elapsed = 0;
    let completedRequests = 0;
    
    const interval = setInterval(() => {
      elapsed += 0.5;
      completedRequests += Math.floor(Math.random() * 20) + 10;
      
      setTestProgress(prev => ({
        ...prev!,
        elapsed_time: elapsed,
        completed_requests: completedRequests
      }));
      
      // After 5 seconds, complete the test and show the completion dialog
      if (elapsed >= 5) {
        clearInterval(interval);
        setTestProgress(prev => ({
          ...prev!,
          status: 'completed',
          completed_requests: 250
        }));
        setIsLoading(false);
        setShowCompletionDialog(true);
      }
    }, 500);
    
    setPollingInterval(interval);
  };

  // Render session status information
  const renderSessionStatus = () => {
    if (!sessionStatus || sessionStatus.acquired_sessions.length === 0) {
      return (
        <div className="flex items-center">
          <Clock className="h-5 w-5 text-blue-500 mr-2" />
          <span>Waiting for session information...</span>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <h5 className="text-sm font-medium">Authentication Status</h5>
        {sessionStatus.auth_type === 'session' && (
          <div className="text-xs text-gray-500 mb-2">
            Login endpoint: {sessionStatus.login_endpoint}
          </div>
        )}
        <div className="space-y-2">
          {sessionStatus.acquired_sessions.map((session, index) => {
            const isSuccessful = session.status === 'acquired' || session.status === 'valid';
            
            return (
              <div key={index} className="flex items-start border-l-2 pl-3 py-1" 
                   style={{ borderColor: isSuccessful ? '#10b981' : '#ef4444' }}>
                {isSuccessful ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 mr-2 mt-0.5" />
                )}
                <div className="text-sm">
                  <div className="font-medium">
                    {session.account || session.username || session.token_id || 'Session'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {isSuccessful ? (
                      <span>
                        {session.status === 'acquired' ? 'Session acquired' : 'Valid credentials'}
                        {session.acquired_at && ` at ${new Date(session.acquired_at).toLocaleTimeString()}`}
                      </span>
                    ) : (
                      <span className="text-red-500">
                        {session.error || 'Authentication failed'}
                      </span>
                    )}
                  </div>
                  {session.session_id && (
                    <div className="text-xs text-gray-400 font-mono mt-1">
                      ID: {session.session_id.substring(0, 8)}...
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
        <div className="flex items-center">
          <Loader className="h-5 w-5 text-blue-500 mr-2 animate-spin" />
          <span>Initializing test...</span>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm font-medium">Status</div>
            <div className="flex items-center mt-1">
              {testProgress.status === 'running' ? (
                <>
                  <Loader className="h-4 w-4 text-blue-500 mr-2 animate-spin" />
                  <span className="text-blue-600">Running</span>
                </>
              ) : testProgress.status === 'completed' ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span className="text-green-600">Completed</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-gray-500 mr-2" />
                  <span>{testProgress.status}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm font-medium">Elapsed Time</div>
            <div className="flex items-center mt-1">
              <Clock className="h-4 w-4 text-gray-500 mr-2" />
              <span>{testProgress.elapsed_time.toFixed(1)}s</span>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-md">
          <div className="text-sm font-medium">Completed Requests</div>
          <div className="mt-1">
            <div className="text-2xl font-medium">{testProgress.completed_requests.toLocaleString()}</div>
          </div>
        </div>
        
        {/* Session status section */}
        {authConfig.method !== 'none' && (
          <div className="bg-gray-50 p-3 rounded-md">
            {renderSessionStatus()}
          </div>
        )}
      </div>
    );
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
          
          <div className="p-4 space-y-4">
            {renderProgress()}
          </div>
        </div>
      )}
      
      <div className="flex justify-center pt-4">
        {!testStarted ? (
          <Button
            onClick={startLoadTest}
            disabled={isLoading}
            className="flex items-center py-2 px-8"
            size="lg"
          >
            <Play className="h-5 w-5 mr-2" />
            {isLoading ? 'Starting...' : 'START STRESS TEST'}
          </Button>
        ) : (
          <Button
            onClick={() => setShowCompletionDialog(true)}
            disabled={!testProgress || testProgress.status === 'running'}
            className="flex items-center py-2 px-8"
            size="lg"
          >
            {testProgress && testProgress.status !== 'running' ? (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                VIEW TEST RESULTS
              </>
            ) : (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                TEST RUNNING...
              </>
            )}
          </Button>
        )}
      </div>
      
      {/* Completion Dialog */}
      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
              Stress Test Completed
            </DialogTitle>
            <DialogDescription>
              Your stress test has been completed successfully.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-4 bg-gray-50 rounded-md mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-500">Total Requests</div>
                <div className="text-xl font-semibold">250</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Elapsed Time</div>
                <div className="text-xl font-semibold">5.0s</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Success Rate</div>
                <div className="text-xl font-semibold text-green-600">98.4%</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Avg. Response Time</div>
                <div className="text-xl font-semibold">215ms</div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-4 space-x-2">
            <Button onClick={() => setShowCompletionDialog(false)}>
              Close
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setShowCompletionDialog(false);
                // In a real app, this would navigate to results
                // window.location.href = `/results/${currentTestId}`;
              }}
            >
              View Detailed Results
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 