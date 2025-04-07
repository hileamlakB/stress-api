import { useEffect } from 'react';
import { Plus, Minus, Check } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';
import apiService from '../../../services/ApiService';

export function TestConfigStep() {
  const {
    concurrentRequests,
    setConcurrentRequests,
    distributionMode,
    setDistributionMode,
    showAdvancedOptions,
    setShowAdvancedOptions,
    strategyOptions,
    setStrategyOptions,
    selectedEndpoints
  } = useWizard();
  
  // State for loading distribution strategies from API
  const [availableStrategies, setAvailableStrategies] = useState<string[]>([]);
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(false);
  
  // Fetch distribution strategies when the component mounts
  useEffect(() => {
    fetchDistributionStrategies();
  }, []);
  
  const fetchDistributionStrategies = async () => {
    try {
      setIsLoadingStrategies(true);
      const strategies = await apiService.fetchDistributionStrategies();
      setAvailableStrategies(strategies);
      
      // Set default strategy if none is set and we have strategies available
      if (strategies.length > 0 && !distributionMode) {
        setDistributionMode(strategies[0]);
      }
    } catch (error) {
      console.error('Error fetching distribution strategies:', error);
      // Fallback to default hardcoded values in case of error
      setAvailableStrategies(['sequential', 'interleaved', 'random']);
    } finally {
      setIsLoadingStrategies(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              Configure how your stress test will run. Adjust concurrent requests and choose a distribution strategy 
              for how requests will be sent to your endpoints.
            </p>
          </div>
        </div>
      </div>
      
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
                onClick={() => setDistributionMode(strategy)}
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
                      random_distribution_pattern: e.target.value
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
  );
}

// Import statement added to the top to fix the missing useState
import { useState } from 'react'; 