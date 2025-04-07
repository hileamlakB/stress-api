import { useState } from 'react';
import { Play, AlertCircle } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';
import apiService from '../../../services/ApiService';
import { StressTestConfig, StressTestEndpointConfig } from '../../../types/api';

export function ReviewLaunchStep() {
  const {
    baseUrl,
    authJson,
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
  
  const validateConfig = (): boolean => {
    if (!baseUrl) {
      setValidationError('API Base URL is required');
      return false;
    }
    
    if (selectedEndpoints.length === 0) {
      setValidationError('At least one endpoint must be selected');
      return false;
    }
    
    if (authJson) {
      try {
        JSON.parse(authJson);
      } catch (error) {
        setValidationError('Authentication headers contain invalid JSON');
        return false;
      }
    }
    
    setValidationError(null);
    return true;
  };
  
  const startLoadTest = async () => {
    if (!validateConfig()) {
      return;
    }

    setIsLoading(true);
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
      setIsLoading(false);
    } catch (error) {
      console.error('Error starting load test:', error);
      setValidationError('Failed to start load test. Check console for details.');
      setIsLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
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
                  <span className="text-gray-800">{authJson ? 'Configured' : 'None'}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700">Endpoints ({selectedEndpoints.length})</h4>
            <div className="mt-1 p-3 bg-gray-50 rounded-md max-h-40 overflow-y-auto">
              <ul className="text-sm space-y-1">
                {selectedEndpoints.map((endpoint, index) => (
                  <li key={index} className="flex items-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      endpoint.split(' ')[0] === 'GET' 
                        ? 'bg-blue-100 text-blue-800' 
                        : endpoint.split(' ')[0] === 'POST'
                        ? 'bg-green-100 text-green-800'
                        : endpoint.split(' ')[0] === 'PUT'
                        ? 'bg-yellow-100 text-yellow-800'
                        : endpoint.split(' ')[0] === 'DELETE'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {endpoint.split(' ')[0]}
                    </span>
                    <span className="ml-2 text-gray-800">{endpoint.split(' ')[1]}</span>
                  </li>
                ))}
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
      
      <div className="flex justify-center pt-4">
        <Button
          onClick={startLoadTest}
          disabled={isLoading}
          className="flex items-center py-2 px-8"
          size="lg"
        >
          <Play className="h-5 w-5 mr-2" />
          {isLoading ? 'Starting...' : 'START STRESS TEST'}
        </Button>
      </div>
    </div>
  );
} 