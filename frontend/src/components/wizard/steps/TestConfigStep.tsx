import { useEffect, useState } from 'react';
import { Plus, Minus, Check } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';
import { useTheme } from '../../../contexts/ThemeContext';
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
  const { isDarkMode } = useTheme();
  
  const [availableStrategies, setAvailableStrategies] = useState<string[]>([]);
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(false);
  
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
  
  const handleConcurrentChange = (delta: number) => {
    setConcurrentRequests(Math.max(1, concurrentRequests + delta));
  };
  
  const handleStrategyOptionChange = (key: string, value: number) => {
    setStrategyOptions(prevOptions => ({
      ...prevOptions,
      [key]: value
    }));
  };
  
  return (
    <div className="space-y-6">
      <div className={`bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-400 dark:border-blue-500 p-4 mb-6`}>
        <div className="flex">
          <div className="ml-3">
            <p className={`text-sm text-blue-700 dark:text-blue-200`}>
              Configure how the load test will be executed. Set the number of concurrent users and choose distribution strategies.
            </p>
          </div>
        </div>
      </div>

      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow`}>
        {/* Basic Configuration */}
        <div className={`p-6 border-b border-gray-200 dark:border-gray-700`}>
          <h3 className={`text-lg font-medium text-gray-900 dark:text-gray-100 mb-4`}>Basic Configuration</h3>
          
          {/* Concurrent Users */}
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2`}>
                Concurrent Users
              </label>
              <div className="flex items-center space-x-4">
                <Button
                  onClick={() => handleConcurrentChange(-10)}
                  disabled={concurrentRequests <= 10}
                  className="p-2"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <input
                  type="number"
                  value={concurrentRequests}
                  onChange={(e) => setConcurrentRequests(parseInt(e.target.value) || 1)}
                  min="1"
                  className={`block w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                />
                <Button
                  onClick={() => handleConcurrentChange(10)}
                  className="p-2"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className={`mt-1 text-sm text-gray-500 dark:text-gray-400`}>
                Number of simultaneous users that will make requests to your API
              </p>
            </div>

            {/* Distribution Strategy */}
            <div>
              <label className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2`}>
                Distribution Strategy
              </label>
              <select
                value={distributionMode}
                onChange={(e) => setDistributionMode(e.target.value)}
                className={`block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
              >
                {isLoadingStrategies ? (
                  <option>Loading strategies...</option>
                ) : (
                  availableStrategies.map(strategy => (
                    <option key={strategy} value={strategy}>
                      {strategy.charAt(0).toUpperCase() + strategy.slice(1)}
                    </option>
                  ))
                )}
              </select>
              <p className={`mt-1 text-sm text-gray-500 dark:text-gray-400`}>
                How requests will be distributed across endpoints
              </p>
            </div>
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <div className={`px-6 py-4 bg-gray-50 dark:bg-gray-900`}>
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className={`flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200`}
          >
            <Check className={`h-4 w-4 mr-2 ${showAdvancedOptions ? 'text-indigo-500 dark:text-indigo-400' : ''}`} />
            Advanced Options
          </button>
        </div>

        {/* Advanced Options */}
        {showAdvancedOptions && (
          <div className={`p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900`}>
            <h4 className={`text-sm font-medium text-gray-900 dark:text-gray-100 mb-4`}>Advanced Configuration</h4>
            
            <div className="space-y-4">
              {/* Ramp Up Time */}
              <div>
                <label className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2`}>
                  Ramp Up Time (seconds)
                </label>
                <input
                  type="number"
                  value={strategyOptions.rampUpTime}
                  onChange={(e) => handleStrategyOptionChange('rampUpTime', parseInt(e.target.value))}
                  min="0"
                  className={`block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                />
                <p className={`mt-1 text-sm text-gray-500 dark:text-gray-400`}>
                  Time to gradually increase load to target concurrent users
                </p>
              </div>

              {/* Hold Time */}
              <div>
                <label className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2`}>
                  Hold Time (seconds)
                </label>
                <input
                  type="number"
                  value={strategyOptions.holdTime}
                  onChange={(e) => handleStrategyOptionChange('holdTime', parseInt(e.target.value))}
                  min="0"
                  className={`block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                />
                <p className={`mt-1 text-sm text-gray-500 dark:text-gray-400`}>
                  Duration to maintain target concurrent users
                </p>
              </div>

              {/* Think Time */}
              <div>
                <label className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2`}>
                  Think Time (milliseconds)
                </label>
                <input
                  type="number"
                  value={strategyOptions.thinkTime}
                  onChange={(e) => handleStrategyOptionChange('thinkTime', parseInt(e.target.value))}
                  min="0"
                  className={`block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                />
                <p className={`mt-1 text-sm text-gray-500 dark:text-gray-400`}>
                  Delay between consecutive requests from the same user
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}