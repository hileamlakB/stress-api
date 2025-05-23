import { useState, useEffect } from 'react';
import { Settings, Info, KeyRound, User, FileText, Cookie, X, ChevronDown, Plus, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../../Button';
import { useWizard } from '../WizardContext';
import { AuthMethod, AuthConfig } from '../WizardContext';
import { JsonEditor } from '../../JsonEditor';

// Function to validate authentication configuration
export const validateAuthConfig = (config: AuthConfig, baseUrl: string): { valid: boolean; message?: string } => {
  // Check if base URL is provided
  if (!baseUrl || !baseUrl.trim()) {
    return { valid: false, message: 'Please enter a base URL for the API' };
  }

  // For 'none' authentication, no additional validation needed
  if (config.method === 'none') {
    return { valid: true };
  }

  // Validate API Key authentication
  if (config.method === 'api_key') {
    if (!config.apiKey || !config.apiKey.key || !config.apiKey.key.trim()) {
      return { valid: false, message: 'Please enter an API key name' };
    }
    if (!config.apiKey.value || !config.apiKey.value.trim()) {
      return { valid: false, message: 'Please enter an API key value' };
    }
    return { valid: true };
  }

  // Validate Bearer Token authentication
  if (config.method === 'bearer_token') {
    if (config.multipleTokens) {
      // Check if at least one token is provided
      if (!config.tokensList || config.tokensList.length === 0) {
        return { valid: false, message: 'Please add at least one bearer token' };
      }
      
      // Check if any token is empty
      const hasEmptyToken = config.tokensList.some(token => !token || !token.trim());
      if (hasEmptyToken) {
        return { valid: false, message: 'Please fill in all bearer tokens' };
      }
    } else {
      // Single token validation
      if (!config.bearerToken || !config.bearerToken.trim()) {
        return { valid: false, message: 'Please enter a bearer token' };
      }
    }
    return { valid: true };
  }

  // Validate Basic Authentication
  if (config.method === 'basic_auth') {
    if (config.multipleBasicAuth) {
      // Check if at least one credential is provided
      if (!config.basicAuthList || config.basicAuthList.length === 0) {
        return { valid: false, message: 'Please add at least one set of credentials' };
      }
      
      // Check if any credential is incomplete
      const hasIncompleteCredential = config.basicAuthList.some(
        auth => !auth.username || !auth.username.trim() || !auth.password || !auth.password.trim()
      );
      if (hasIncompleteCredential) {
        return { valid: false, message: 'Please complete all username and password fields' };
      }
    } else {
      // Single credential validation
      if (!config.basicAuth || !config.basicAuth.username || !config.basicAuth.username.trim()) {
        return { valid: false, message: 'Please enter a username' };
      }
      if (!config.basicAuth.password || !config.basicAuth.password.trim()) {
        return { valid: false, message: 'Please enter a password' };
      }
    }
    return { valid: true };
  }

  // Validate Session Cookie authentication
  if (config.method === 'session_cookie') {
    if (!config.sessionCookie || !config.sessionCookie.loginUrl || !config.sessionCookie.loginUrl.trim()) {
      return { valid: false, message: 'Please enter a login endpoint URL' };
    }

    if (config.sessionCookie.multipleAccounts) {
      // Check if at least one account is provided
      if (!config.sessionCookie.accountsList || config.sessionCookie.accountsList.length === 0) {
        return { valid: false, message: 'Please add at least one account' };
      }
      
      // Check if any account is empty (no credentials)
      const hasEmptyAccount = config.sessionCookie.accountsList.some(
        account => !account || Object.keys(account).length === 0
      );
      if (hasEmptyAccount) {
        return { valid: false, message: 'Please provide credentials for all accounts' };
      }
    } else {
      // Single account validation
      if (!config.sessionCookie.credentials || Object.keys(config.sessionCookie.credentials).length === 0) {
        return { valid: false, message: 'Please provide login credentials' };
      }
    }
    return { valid: true };
  }

  // Validate Custom Headers
  if (config.method === 'custom_headers') {
    // Currently, we're not requiring specific headers, but we could add validation if needed
    return { valid: true };
  }

  return { valid: true };
};

// Function to fetch parameters for a login endpoint
async function fetchLoginParameters(loginUrl: string, method: string): Promise<any> {
  try {
    const response = await fetch('/api/analyze-login-endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login_url: loginUrl,
        method: method
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to analyze login endpoint');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching login parameters:', error);
    throw error;
  }
}

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
  
  // State for parameter fetching
  const [fetchingParameters, setFetchingParameters] = useState(false);
  const [parameterFetchError, setParameterFetchError] = useState('');
  const [lastFetchedUrl, setLastFetchedUrl] = useState('');
  
  // Log validation status on mount and when key values change
  useEffect(() => {
    const result = validateAuthConfig(authConfig, baseUrl);
    console.log("ApiConfigStep validation check:", {
      baseUrl,
      authMethod: authConfig.method,
      isValid: result.valid,
      message: result.message,
      sessionCookie: authConfig.sessionCookie ? {
        hasLoginUrl: !!authConfig.sessionCookie.loginUrl,
        hasCredentials: !!authConfig.sessionCookie.credentials,
        hasMultipleAccounts: authConfig.sessionCookie.multipleAccounts,
        accountsCount: authConfig.sessionCookie.accountsList?.length || 0
      } : null
    });
  }, [baseUrl, authConfig, authConfig.method]);
  
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
  
  // Get auth method description
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
  
  // Handle authentication JSON change
  const handleAuthJsonChange = (value: string) => {
    try {
      // Make sure the JSON is valid
      if (value) {
        JSON.parse(value);
      }
      
    setAuthJson(value);
      setAuthError('');
      validateAuthJson(value);
    } catch (error) {
      // Skip validation if the error came from JsonEditor, which already validates
      if (typeof value === 'string' && value.trim().startsWith('{')) {
        setAuthError('Invalid JSON format');
      } else {
        setAuthJson(value);
      }
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
  
  // Function to handle parameter fetching
  const handleFetchParameters = async () => {
    const loginUrl = authConfig.sessionCookie?.loginUrl;
    const method = authConfig.sessionCookie?.method || 'POST';
    
    if (!loginUrl) {
      setParameterFetchError('Login URL is required');
      return;
    }
    
    setFetchingParameters(true);
    setParameterFetchError('');
    
    try {
      const result = await fetchLoginParameters(loginUrl, method);
      setLastFetchedUrl(loginUrl);
      
      // Create a credentials object from the parameters
      const credentials: Record<string, string> = {};
      
      // Add required parameters first
      if (result.parameters.required && result.parameters.required.length > 0) {
        result.parameters.required.forEach((param: any) => {
          if (param.in !== 'header' && param.in !== 'path') {
            // Use empty string instead of undefined/null for better UX
            credentials[param.name] = param.example || '';
          }
        });
      }
      
      // Add optional parameters
      if (result.parameters.optional && result.parameters.optional.length > 0) {
        result.parameters.optional.forEach((param: any) => {
          if (param.in !== 'header' && param.in !== 'path') {
            credentials[param.name] = param.example || '';
          }
        });
      }
      
      // Force empty object if no parameters found to clear placeholders
      if (Object.keys(credentials).length === 0) {
        credentials['username'] = '';
      }
      
      console.log("Setting credentials:", credentials);
      
      // Update the auth config with the new credentials
      setAuthConfig({
        ...authConfig,
        sessionCookie: {
          ...authConfig.sessionCookie!,
          credentials: credentials
        }
      });
      
    } catch (error) {
      console.error('Error fetching parameters:', error);
      setParameterFetchError(error instanceof Error ? error.message : 'Failed to fetch parameters');
    } finally {
      setFetchingParameters(false);
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
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={authConfig.sessionCookie?.loginUrl || ''}
                  onChange={(e) => handleSessionCookieChange('loginUrl', e.target.value)}
                  placeholder="https://api.example.com/login"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button
                  onClick={handleFetchParameters}
                  disabled={fetchingParameters || !authConfig.sessionCookie?.loginUrl}
                  className="whitespace-nowrap flex items-center"
                >
                  {fetchingParameters ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-1" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Fetch Parameters
                    </>
                  )}
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                The full URL to the login endpoint
              </p>
              {parameterFetchError && (
                <p className="mt-1 text-xs text-red-500">
                  {parameterFetchError}
                </p>
              )}
              {lastFetchedUrl && (
                <p className="mt-1 text-xs text-green-500">
                  Parameters fetched successfully for: {lastFetchedUrl}
                </p>
              )}
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
                  Login Credentials
                </label>
                <JsonEditor
                  value={authConfig.sessionCookie?.credentials || {}}
                  onChange={(value) => handleSessionCookieChange('credentials', value)}
                  placeholder={lastFetchedUrl ? {} : { "phone_number": "+1234567890", "otp_code": "123456" }}
                  error={authError}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {lastFetchedUrl 
                    ? "Parameters detected from the login endpoint" 
                    : "Provide key-value pairs for login credentials"}
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
                      <JsonEditor
                        value={account}
                        onChange={(value) => updateAccount(index, value)}
                        placeholder={{ "phone_number": "+1234567890", "otp_code": "123456" }}
                        error={authError && index === authConfig.sessionCookie.accountsList.length - 1 ? authError : undefined}
                      />
                    </div>
                  ))}
                </div>
                
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
              Custom Headers
            </label>
            <JsonEditor
              value={authJson ? (() => {
                try {
                  return JSON.parse(authJson);
                } catch (e) {
                  return {};
                }
              })() : {}}
              onChange={(value) => handleAuthJsonChange(JSON.stringify(value))}
              placeholder={{ "Authorization": "Bearer YOUR_TOKEN", "X-Custom-Header": "value" }}
              error={authError}
            />
            <p className="mt-1 text-xs text-gray-500">
              Specify any custom headers as key-value pairs
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