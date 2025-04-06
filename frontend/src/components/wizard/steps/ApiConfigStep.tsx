import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';

export function ApiConfigStep() {
  const { 
    baseUrl, 
    setBaseUrl, 
    authJson, 
    setAuthJson, 
    validateAuthJson 
  } = useWizard();
  
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
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              First, let's set up the API you want to test. Enter the base URL of your FastAPI application 
              and configure any authentication headers if needed.
            </p>
          </div>
        </div>
      </div>
      
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
            <p className="text-sm text-gray-600 mb-3">
              Specify authentication headers as a JSON object. These will be included with every request during load testing.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Authentication Headers (JSON)
            </label>
            <textarea
              value={authJson}
              onChange={(e) => handleAuthJsonChange(e.target.value)}
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
  );
} 