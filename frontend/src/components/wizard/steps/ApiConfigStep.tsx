import { useState, useEffect } from 'react';
import { Settings, Info, KeyRound, User, FileText, Cookie, X, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';
import { AuthMethod, AuthConfig } from '../WizardContext';

export function ApiConfigStep() {
  const { 
    baseUrl, 
    setBaseUrl, 
    authJson, 
    setAuthJson, 
    validateAuthJson,
    authConfig,
    setAuthConfig
  } = useWizard();
  
  // Show auth config if there's already a method set other than 'none'
  const [showAuthConfig, setShowAuthConfig] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showAuthDropdown, setShowAuthDropdown] = useState(false);
  
  // Check if authentication is already configured
  useEffect(() => {
    if (authConfig.method !== 'none' || authJson) {
      setShowAuthConfig(true);
    }
  }, []);
  
  // Function to handle authentication method change
  const handleAuthMethodChange = (method: AuthMethod) => {
    setAuthConfig({
      ...authConfig,
      method
    });
    
    // Clear any previous errors
    setAuthError('');
    setShowAuthDropdown(false);
  };
  
  // Get auth method display name 
  const getAuthMethodDisplayName = (method: AuthMethod): string => {
    switch (method) {
      case 'api_key': return 'API Key';
      case 'bearer_token': return 'Bearer Token';
      case 'basic_auth': return 'Basic Authentication';
      case 'custom_headers': return 'Custom Headers';
      case 'session_cookie': return 'Session Cookie';
      case 'none': return 'No Authentication';
      default: return 'Select Authentication Method';
    }
  };
  
  // Get auth method icon
  const getAuthMethodIcon = (method: AuthMethod) => {
    switch (method) {
      case 'api_key': return <KeyRound className="h-4 w-4" />;
      case 'bearer_token': return <FileText className="h-4 w-4" />;
      case 'basic_auth': return <User className="h-4 w-4" />;
      case 'custom_headers': return <Settings className="h-4 w-4" />;
      case 'session_cookie': return <Cookie className="h-4 w-4" />;
      case 'none': return <X className="h-4 w-4" />;
      default: return null;
    }
  };
  
  // Add description for each authentication method
  const getAuthMethodDescription = (method: AuthMethod): string => {
    switch (method) {
      case 'api_key':
        return 'API keys are simple tokens that are included in requests, either as a header or query parameter. Common for many APIs that require light security.';
      case 'bearer_token':
        return 'Bearer tokens (like JWTs) are sent in the Authorization header. Commonly used with OAuth 2.0 or when a token is issued by an authentication server.';
      case 'basic_auth':
        return 'Basic Authentication uses a username and password encoded in Base64. The credentials are sent with each request in the Authorization header.';
      case 'custom_headers':
        return 'Custom headers allow you to specify any combination of HTTP headers needed for authentication, useful for APIs with proprietary authentication schemes.';
      case 'session_cookie':
        return 'Session-based authentication first performs a login request to obtain cookies, then uses those cookies for all subsequent test requests. Useful for websites and APIs that use cookie-based sessions.';
      case 'none':
        return 'No authentication will be used. Select this option if your API endpoints are publicly accessible.';
      default:
        return '';
    }
  };
  
  // Handle legacy JSON auth changes for backward compatibility
  const handleAuthJsonChange = (value: string) => {
    setAuthJson(value);
    if (validateAuthJson(value)) {
      setAuthError('');
    } else {
      setAuthError('Invalid JSON format');
    }
  };
  
  // Handle updates to API key auth configuration
  const handleApiKeyChange = (field: keyof AuthConfig['apiKey'], value: string) => {
    setAuthConfig({
      ...authConfig,
      apiKey: {
        ...authConfig.apiKey,
        [field]: value
      } as AuthConfig['apiKey']
    });
  };
  
  // Handle bearer token updates
  const handleBearerTokenChange = (value: string) => {
    setAuthConfig({
      ...authConfig,
      bearerToken: value
    });
  };
  
  // Enable/disable multiple bearer tokens
  const handleMultipleTokensChange = (enabled: boolean) => {
    setAuthConfig({
      ...authConfig,
      multipleTokens: enabled,
      // Initialize token list with current token if enabling multiple tokens
      tokensList: enabled 
        ? authConfig.bearerToken ? [authConfig.bearerToken] : ['']
        : undefined
    });
  };
  
  // Add a new bearer token
  const addToken = () => {
    if (!authConfig.tokensList) return;
    
    setAuthConfig({
      ...authConfig,
      tokensList: [...authConfig.tokensList, '']
    });
  };
  
  // Remove a bearer token
  const removeToken = (index: number) => {
    if (!authConfig.tokensList) return;
    if (authConfig.tokensList.length <= 1) return;
    
    setAuthConfig({
      ...authConfig,
      tokensList: authConfig.tokensList.filter((_, i) => i !== index)
    });
  };
  
  // Update a bearer token
  const updateToken = (index: number, value: string) => {
    if (!authConfig.tokensList) return;
    
    const updatedTokens = [...authConfig.tokensList];
    updatedTokens[index] = value;
    
    setAuthConfig({
      ...authConfig,
      tokensList: updatedTokens
    });
  };
  
  // Handle basic auth updates
  const handleBasicAuthChange = (field: keyof AuthConfig['basicAuth'], value: string) => {
    setAuthConfig({
      ...authConfig,
      basicAuth: {
        ...authConfig.basicAuth,
        [field]: value
      } as AuthConfig['basicAuth']
    });
  };
  
  // Enable/disable multiple basic auth credentials
  const handleMultipleBasicAuthChange = (enabled: boolean) => {
    setAuthConfig({
      ...authConfig,
      multipleBasicAuth: enabled,
      // Initialize basic auth list with current credentials if enabling multiple credentials
      basicAuthList: enabled 
        ? authConfig.basicAuth ? [{...authConfig.basicAuth}] : [{username: '', password: ''}]
        : undefined
    });
  };
  
  // Add a new basic auth credential
  const addBasicAuth = () => {
    if (!authConfig.basicAuthList) return;
    
    setAuthConfig({
      ...authConfig,
      basicAuthList: [...authConfig.basicAuthList, {username: '', password: ''}]
    });
  };
  
  // Remove a basic auth credential
  const removeBasicAuth = (index: number) => {
    if (!authConfig.basicAuthList) return;
    if (authConfig.basicAuthList.length <= 1) return;
    
    setAuthConfig({
      ...authConfig,
      basicAuthList: authConfig.basicAuthList.filter((_, i) => i !== index)
    });
  };
  
  // Update a basic auth credential
  const updateBasicAuth = (index: number, field: 'username' | 'password', value: string) => {
    if (!authConfig.basicAuthList) return;
    
    const updatedList = [...authConfig.basicAuthList];
    updatedList[index] = {
      ...updatedList[index],
      [field]: value
    };
    
    setAuthConfig({
      ...authConfig,
      basicAuthList: updatedList
    });
  };
  
  // Handle session cookie auth updates
  const handleSessionCookieChange = (field: string, value: string | Record<string, string> | boolean) => {
    if (field === 'credentials') {
      try {
        // If credentials are provided as a string, try to parse as JSON
        const credentials = typeof value === 'string' 
          ? JSON.parse(value) 
          : value;
          
        setAuthConfig({
          ...authConfig,
          sessionCookie: {
            ...authConfig.sessionCookie,
            credentials
          }
        });
        setAuthError('');
      } catch (error) {
        setAuthError('Invalid JSON format for credentials');
      }
    } else if (field === 'multipleAccounts') {
      // Handle toggling multiple accounts
      const multipleAccounts = value as boolean;
      
      setAuthConfig({
        ...authConfig,
        sessionCookie: {
          ...authConfig.sessionCookie,
          multipleAccounts,
          // Initialize accounts list with the current credentials if enabling multiple accounts
          accountsList: multipleAccounts 
            ? [authConfig.sessionCookie?.credentials || {}] 
            : undefined
        }
      });
    } else {
      setAuthConfig({
        ...authConfig,
        sessionCookie: {
          ...authConfig.sessionCookie,
          [field]: value
        }
      });
    }
  };
  
  // Add a new account to the accounts list
  const addAccount = () => {
    if (!authConfig.sessionCookie?.accountsList) return;
    
    setAuthConfig({
      ...authConfig,
      sessionCookie: {
        ...authConfig.sessionCookie,
        accountsList: [
          ...authConfig.sessionCookie.accountsList,
          {} // Add empty account
        ]
      }
    });
  };
  
  // Remove an account from the accounts list
  const removeAccount = (index: number) => {
    if (!authConfig.sessionCookie?.accountsList) return;
    if (authConfig.sessionCookie.accountsList.length <= 1) return;
    
    setAuthConfig({
      ...authConfig,
      sessionCookie: {
        ...authConfig.sessionCookie,
        accountsList: authConfig.sessionCookie.accountsList.filter((_, i) => i !== index)
      }
    });
  };
  
  // Update an account in the accounts list
  const updateAccount = (index: number, accountData: Record<string, string> | string) => {
    if (!authConfig.sessionCookie?.accountsList) return;
    
    try {
      // If account data is provided as a string, try to parse as JSON
      const parsedAccountData = typeof accountData === 'string' 
        ? JSON.parse(accountData) 
        : accountData;
      
      const updatedAccounts = [...authConfig.sessionCookie.accountsList];
      updatedAccounts[index] = parsedAccountData;
      
      setAuthConfig({
        ...authConfig,
        sessionCookie: {
          ...authConfig.sessionCookie,
          accountsList: updatedAccounts
        }
      });
      setAuthError('');
    } catch (error) {
      setAuthError('Invalid JSON format for account credentials');
    }
  };
  
  // Render authentication method specific fields
  const renderAuthFields = () => {
    switch (authConfig.method) {
      case 'api_key':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key Name
              </label>
              <input
                type="text"
                value={authConfig.apiKey?.key || ''}
                onChange={(e) => handleApiKeyChange('key', e.target.value)}
                placeholder="X-API-Key"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key Value
              </label>
              <input
                type="text"
                value={authConfig.apiKey?.value || ''}
                onChange={(e) => handleApiKeyChange('value', e.target.value)}
                placeholder="your-api-key-value"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Add to
              </label>
              <select
                value={authConfig.apiKey?.addTo || 'header'}
                onChange={(e) => handleApiKeyChange('addTo', e.target.value as 'header' | 'query')}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="header">Header</option>
                <option value="query">Query Parameter</option>
              </select>
            </div>
          </div>
        );
        
      case 'bearer_token':
        return (
          <div className="space-y-4">
            {!authConfig.multipleTokens ? (
              // Single bearer token
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bearer Token
                </label>
                <input
                  type="text"
                  value={authConfig.bearerToken || ''}
                  onChange={(e) => handleBearerTokenChange(e.target.value)}
                  placeholder="your-token-here"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ) : (
              // Multiple bearer tokens
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Bearer Tokens</h3>
                  <Button 
                    onClick={addToken}
                    size="sm"
                    variant="outline"
                    className="flex items-center"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Token
                  </Button>
                </div>
                
                {authConfig.tokensList?.map((token, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={token}
                      onChange={(e) => updateToken(index, e.target.value)}
                      placeholder="Bearer token"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {authConfig.tokensList!.length > 1 && (
                      <Button 
                        onClick={() => removeToken(index)}
                        variant="ghost"
                        size="icon"
                        className="flex items-center justify-center"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Toggle for multiple tokens */}
            <div className="flex items-center mt-4">
              <input
                type="checkbox"
                id="multipleTokens"
                checked={!!authConfig.multipleTokens}
                onChange={(e) => handleMultipleTokensChange(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="multipleTokens" className="ml-2 block text-sm text-gray-700">
                Use multiple bearer tokens for distributed testing
              </label>
            </div>
            
            <div className="mt-2 text-xs text-gray-500">
              Multiple tokens allow distributing requests across different authentication contexts,
              useful for testing rate limits or simulating different users.
            </div>
          </div>
        );
        
      case 'basic_auth':
        return (
          <div className="space-y-4">
            {!authConfig.multipleBasicAuth ? (
              // Single basic auth credential
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={authConfig.basicAuth?.username || ''}
                    onChange={(e) => handleBasicAuthChange('username', e.target.value)}
                    placeholder="username"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={authConfig.basicAuth?.password || ''}
                    onChange={(e) => handleBasicAuthChange('password', e.target.value)}
                    placeholder="password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </>
            ) : (
              // Multiple basic auth credentials
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Basic Auth Credentials</h3>
                  <Button 
                    onClick={addBasicAuth}
                    size="sm"
                    variant="outline"
                    className="flex items-center"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Credential
                  </Button>
                </div>
                
                {authConfig.basicAuthList?.map((auth, index) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Credential #{index + 1}</h4>
                      {authConfig.basicAuthList!.length > 1 && (
                        <Button 
                          onClick={() => removeBasicAuth(index)}
                          variant="ghost"
                          size="icon"
                          className="flex items-center justify-center"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          value={auth.username}
                          onChange={(e) => updateBasicAuth(index, 'username', e.target.value)}
                          placeholder="username"
                          className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          value={auth.password}
                          onChange={(e) => updateBasicAuth(index, 'password', e.target.value)}
                          placeholder="password"
                          className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Toggle for multiple basic auth credentials */}
            <div className="flex items-center mt-4">
              <input
                type="checkbox"
                id="multipleBasicAuth"
                checked={!!authConfig.multipleBasicAuth}
                onChange={(e) => handleMultipleBasicAuthChange(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="multipleBasicAuth" className="ml-2 block text-sm text-gray-700">
                Use multiple basic auth credentials for distributed testing
              </label>
            </div>
            
            <div className="mt-2 text-xs text-gray-500">
              Multiple credentials allow distributing requests across different users,
              useful for testing role-based access or simulating different user permissions.
            </div>
          </div>
        );
      
      case 'session_cookie':
        return (
          <div className="space-y-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <Info className="h-5 w-5 text-yellow-500" />
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    The test will first perform a login request to obtain session cookies, 
                    then use those cookies for all subsequent test requests.
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Login Endpoint URL
              </label>
              <input
                type="text"
                value={authConfig.sessionCookie?.loginUrl || ''}
                onChange={(e) => handleSessionCookieChange('loginUrl', e.target.value)}
                placeholder="https://api.example.com/login"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                The full URL to the login endpoint
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                HTTP Method
              </label>
              <select
                value={authConfig.sessionCookie?.method || 'POST'}
                onChange={(e) => handleSessionCookieChange('method', e.target.value as 'GET' | 'POST' | 'PUT')}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2 mt-4">
              <input
                type="checkbox"
                id="multipleAccounts"
                checked={authConfig.sessionCookie?.multipleAccounts || false}
                onChange={(e) => handleSessionCookieChange('multipleAccounts', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="multipleAccounts" className="text-sm font-medium text-gray-700">
                Use multiple user accounts
              </label>
              <div className="relative group">
                <Info className="h-4 w-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-black bg-opacity-80 text-white text-xs rounded shadow-lg z-10">
                  Using multiple accounts distributes the load across different users, creating more realistic test scenarios and preventing rate limiting issues.
                </div>
              </div>
            </div>
            
            {!authConfig.sessionCookie?.multipleAccounts ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Login Credentials (JSON)
                </label>
                <textarea
                  value={authConfig.sessionCookie?.credentials ? JSON.stringify(authConfig.sessionCookie.credentials, null, 2) : ''}
                  onChange={(e) => handleSessionCookieChange('credentials', e.target.value)}
                  rows={5}
                  placeholder={'{\n  "username": "user@example.com",\n  "password": "password123"\n}'}
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
                  Provide login credentials as a JSON object
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Test Accounts
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center text-xs h-8"
                    onClick={addAccount}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Account
                  </Button>
                </div>
                
                <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                  {authConfig.sessionCookie?.accountsList?.map((account, index) => (
                    <div key={index} className="border border-gray-200 rounded-md p-3 bg-white">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-medium text-gray-700">Account {index + 1}</h4>
                        <button 
                          type="button"
                          onClick={() => removeAccount(index)}
                          disabled={authConfig.sessionCookie?.accountsList?.length === 1}
                          className={`text-gray-400 hover:text-red-500 ${
                            authConfig.sessionCookie?.accountsList?.length === 1 ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        value={JSON.stringify(account, null, 2)}
                        onChange={(e) => updateAccount(index, e.target.value)}
                        rows={4}
                        placeholder={'{\n  "username": "user@example.com",\n  "password": "password123"\n}'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>
                
                {authError && (
                  <p className="mt-1 text-xs text-red-500">{authError}</p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  The test will randomly distribute requests across these accounts, creating a more realistic load pattern.
                </p>
              </div>
            )}
          </div>
        );
        
      case 'custom_headers':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom Headers (JSON)
            </label>
            <textarea
              value={authJson}
              onChange={(e) => handleAuthJsonChange(e.target.value)}
              rows={5}
              placeholder={'{\n  "Authorization": "Bearer YOUR_TOKEN_HERE",\n  "X-Custom-Header": "value"\n}'}
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
              Specify any custom headers as a JSON object
            </p>
          </div>
        );
        
      case 'none':
      default:
        return (
          <div className="text-center text-gray-500 italic py-6">
            No authentication will be used for requests
          </div>
        );
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              First, let's set up the API you want to test. Enter the base URL of your FastAPI application 
              and configure any authentication if needed.
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
        <div className="flex items-center space-x-2">
          <div className="relative group">
            <Info className="h-4 w-4 text-gray-400 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-black bg-opacity-80 text-white text-xs rounded shadow-lg z-10">
              Authentication determines how the stress test will identify itself to your API. 
              Select the method that matches your API's security requirements.
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowAuthConfig(!showAuthConfig)}
            className="flex items-center"
          >
            <Settings className="h-4 w-4 mr-1" />
            {showAuthConfig ? 'Hide Authentication' : 'Configure Authentication'}
          </Button>
          {authConfig.method !== 'none' && (
            <span className="text-xs text-gray-500">
              Current: <span className="font-medium">{getAuthMethodDisplayName(authConfig.method)}</span>
            </span>
          )}
        </div>
        
        {showAuthConfig && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium text-gray-700">Authentication Method</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuthConfig(false)}
                className="h-8 w-8 p-0 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="relative mb-4">
              <button
                type="button"
                onClick={() => setShowAuthDropdown(!showAuthDropdown)}
                className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-md text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <div className="flex items-center">
                  {getAuthMethodIcon(authConfig.method)}
                  <span className="ml-2">{getAuthMethodDisplayName(authConfig.method)}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>
              
              {showAuthDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 py-1">
                  <button
                    onClick={() => handleAuthMethodChange('none')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center"
                  >
                    <X className="h-4 w-4 mr-2" />
                    <span>No Authentication</span>
                  </button>
                  <button
                    onClick={() => handleAuthMethodChange('api_key')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center"
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    <span>API Key</span>
                  </button>
                  <button
                    onClick={() => handleAuthMethodChange('bearer_token')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    <span>Bearer Token</span>
                  </button>
                  <button
                    onClick={() => handleAuthMethodChange('basic_auth')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center"
                  >
                    <User className="h-4 w-4 mr-2" />
                    <span>Basic Authentication</span>
                  </button>
                  <button
                    onClick={() => handleAuthMethodChange('session_cookie')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center"
                  >
                    <Cookie className="h-4 w-4 mr-2" />
                    <span>Session Cookie</span>
                  </button>
                  <button
                    onClick={() => handleAuthMethodChange('custom_headers')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    <span>Custom Headers</span>
                  </button>
                </div>
              )}
            </div>
            
            <div className="mb-4 bg-blue-50 border-l-4 border-blue-400 p-3">
              <div className="flex">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <p className="ml-3 text-sm text-blue-700">
                  {getAuthMethodDescription(authConfig.method)}
                </p>
              </div>
            </div>
            
            {authConfig.method !== 'none' && (
              <div className="border-t border-gray-200 pt-4">
                {renderAuthFields()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 