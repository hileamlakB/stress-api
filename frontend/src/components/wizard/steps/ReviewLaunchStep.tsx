import { useState } from 'react';
import { Play, AlertCircle } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';
import { useTheme } from '../../../contexts/ThemeContext';
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
  const { isDarkMode } = useTheme();
  
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
      <div className="bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-400 dark:border-blue-500 p-4">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-blue-700 dark:text-blue-200">
              Review your test configuration and launch the load test when ready.
            </p>
          </div>
        </div>
      </div>

      {validationError && (
        <div className="bg-red-50 dark:bg-red-900 border-l-4 border-red-400 dark:border-red-500 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 dark:text-red-300" />
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-200">{validationError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {/* Configuration Summary */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Test Configuration</h3>
          
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">API Base URL</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{baseUrl}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Authentication</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {authJson ? 'Configured' : 'None'}
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Concurrent Users</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{concurrentRequests}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Distribution Strategy</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {distributionMode.charAt(0).toUpperCase() + distributionMode.slice(1)}
              </dd>
            </div>

            {showAdvancedOptions && (
              <>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Ramp Up Time</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{strategyOptions.rampUpTime}s</dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Hold Time</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{strategyOptions.holdTime}s</dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Think Time</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{strategyOptions.thinkTime}ms</dd>
                </div>
              </>
            )}
          </dl>
        </div>

        {/* Selected Endpoints */}
        <div className="p-6">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Selected Endpoints</h4>
          
          <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-2">Method</div>
                <div className="col-span-6">Path</div>
                <div className="col-span-4">Configuration</div>
              </div>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {selectedEndpoints.map((endpoint, index) => {
                const [method, path] = endpoint.split(' ');
                return (
                  <div key={index} className="px-4 py-3 bg-white dark:bg-gray-800">
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          method === 'GET'
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : method === 'POST'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : method === 'PUT'
                            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                        }`}>
                          {method}
                        </span>
                      </div>
                      <div className="col-span-6">
                        <span className="text-sm text-gray-900 dark:text-gray-100">{path}</span>
                      </div>
                      <div className="col-span-4">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {endpointConfigs[endpoint]?.weight 
                            ? `Weight: ${endpointConfigs[endpoint].weight}`
                            : 'Default configuration'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Launch Button */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-end">
            <Button
              onClick={startLoadTest}
              disabled={isLoading}
              className="inline-flex items-center"
            >
              <Play className="h-4 w-4 mr-2" />
              {isLoading ? 'Starting Test...' : 'Launch Test'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}