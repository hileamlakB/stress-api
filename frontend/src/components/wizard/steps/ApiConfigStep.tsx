import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';
import { useTheme } from '../../../contexts/ThemeContext';

export function ApiConfigStep() {
  const { 
    baseUrl, 
    setBaseUrl, 
    authJson, 
    setAuthJson, 
    validateAuthJson 
  } = useWizard();
  const { isDarkMode } = useTheme();
  
  const [showAuthConfig, setShowAuthConfig] = useState(!!authJson);
  const [authError, setAuthError] = useState('');
  
  const handleAuthJsonChange = (value: string) => {
    setAuthJson(value);
    if (validateAuthJson(value)) {
      setAuthError('');
    } else {
      setAuthError('Invalid JSON format');
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-400 dark:border-blue-500 p-4 mb-6">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-blue-700 dark:text-blue-200">
              First, let's set up the API you want to test. Enter the base URL of your FastAPI application 
              and configure any authentication headers if needed.
            </p>
          </div>
        </div>
      </div>
      
      <div>
        <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          API Base URL
        </label>
        <div className="flex">
          <input
            id="baseUrl"
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://your-api.com"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Example: http://localhost:8000 or https://api.example.com
        </p>
      </div>

      <div className="flex items-center">
        <Button
          variant={showAuthConfig ? "default" : "outline"}
          onClick={() => setShowAuthConfig(!showAuthConfig)}
          className="flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          {showAuthConfig ? 'Hide Authentication' : 'Configure Authentication'}
        </Button>
      </div>

      {showAuthConfig && (
        <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Authentication Headers (JSON)
          </label>
          <textarea
            value={authJson}
            onChange={(e) => handleAuthJsonChange(e.target.value)}
            rows={5}
            placeholder='{"Authorization": "Bearer YOUR_TOKEN_HERE"}'
            className={`w-full px-4 py-2 border ${
              authError ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
            } rounded-md focus:outline-none focus:ring-2 ${
              authError ? 'focus:ring-red-500 dark:focus:ring-red-400' : 'focus:ring-indigo-500 dark:focus:ring-indigo-400'
            } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
          />
          {authError && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{authError}</p>
          )}
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Specify authentication headers as a JSON object. These will be included with every request during load testing.
          </p>
        </div>
      )}
    </div>
  );
}