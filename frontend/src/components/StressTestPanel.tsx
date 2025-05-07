/**
 * StressTestPanel Component
 * 
 * A comprehensive UI for configuring and running API stress tests with various authentication methods,
 * endpoint configurations, and distribution strategies. This component allows testing different
 * authentication methods (API key, bearer token, basic auth, session cookies), configuring test data,
 * and running tests with different distribution strategies (sequential, interleaved, random).
 */
import React, { useState } from 'react';
import apiService from '../services/ApiService';

// Define TypeScript interfaces to match our configuration structure
interface TestDataParams {
  path_params: Record<string, any>;
  query_params: Record<string, any>;
  request_body: Record<string, any>;
}

interface TestDataSample {
  name: string;
  data: TestDataParams;
}

// Simplified endpoint interface
interface EndpointConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  weight: number;
  test_data_samples?: TestDataSample[];
  data_strategy?: 'random_each_time' | 'consistent_random' | 'user_defined';
  content_type?: 'application/json' | 'multipart/form-data' | 'application/x-www-form-urlencoded';
  has_body?: boolean;
}

// Separate interfaces for each authentication method
interface NoAuth {
  method: 'none';
}

interface ApiKeyAuth {
  method: 'api_key';
  apiKey: {
    key: string;
    value: string;
    addTo: 'header' | 'query';
  };
}

interface BearerTokenAuth {
  method: 'bearer_token';
  bearerToken: string;
  multipleTokens?: false;
}

interface MultipleTokensAuth {
  method: 'bearer_token';
  multipleTokens: true;
  tokensList: string[];
}

interface BasicAuth {
  method: 'basic_auth';
  basicAuth: {
    username: string;
    password: string;
  };
  multipleBasicAuth?: false;
}

interface MultipleBasicAuth {
  method: 'basic_auth';
  multipleBasicAuth: true;
  basicAuthList: Array<{username: string, password: string}>;
}

interface SessionCookieAuth {
  method: 'session_cookie';
  sessionCookie: {
    loginUrl: string;
    method: 'GET' | 'POST' | 'PUT';
    credentials: Record<string, string>;
    extractCookie?: boolean;
    multipleAccounts?: false;
  };
}

interface MultipleSessionAuth {
  method: 'session_cookie';
  sessionCookie: {
    loginUrl: string;
    method: 'GET' | 'POST' | 'PUT';
    credentials: Record<string, string>;
    extractCookie?: boolean;
    multipleAccounts: true;
    accountsList: Array<Record<string, string>>;
  };
}

interface CustomHeadersAuth {
  method: 'custom_headers';
  customHeaders: Record<string, string>;
}

// Union type for all authentication methods
type AuthConfig = 
  | NoAuth
  | ApiKeyAuth
  | BearerTokenAuth
  | MultipleTokensAuth
  | BasicAuth
  | MultipleBasicAuth
  | SessionCookieAuth
  | MultipleSessionAuth
  | CustomHeadersAuth;

interface StressTestConfig {
  target_url: string;
  max_concurrent_users: number;
  request_rate: number;
  duration: number;
  strategy: 'sequential' | 'interleaved' | 'random';
  endpoints: EndpointConfig[];
  use_random_session?: boolean;
  query_params?: Record<string, string>;
  strategy_options?: Record<string, any>;
  authentication?: AuthConfig;
}

// Simplified utility functions to create endpoints with test data
const createGetEndpoint = (
  path: string, 
  weight: number = 1.0,
  testData?: TestDataParams[]
): EndpointConfig => {
  const samples = testData?.map((data, index) => ({
    name: `Sample Data ${index + 1}`,
    data
  }));
  
  return {
    path,
    method: 'GET',
    weight,
    test_data_samples: samples,
    has_body: false
  };
};

const createPostEndpoint = (
  path: string, 
  weight: number = 1.0,
  testData?: TestDataParams[],
  contentType: 'application/json' | 'multipart/form-data' | 'application/x-www-form-urlencoded' = 'application/json'
): EndpointConfig => {
  const samples = testData?.map((data, index) => ({
    name: `Sample Data ${index + 1}`,
    data
  }));
  
  return {
    path,
    method: 'POST',
    weight,
    test_data_samples: samples,
    content_type: contentType,
    has_body: true
  };
};

// Helper functions for creating authentication configurations
const createNoAuth = (): NoAuth => {
  return {
    method: "none"
  };
};

const createApiKeyAuth = (
  key: string,
  value: string,
  addTo: 'header' | 'query' = 'header'
): ApiKeyAuth => {
  return {
    method: "api_key",
    apiKey: {
      key,
      value,
      addTo
    }
  };
};

const createBearerTokenAuth = (token: string): BearerTokenAuth => {
  return {
    method: "bearer_token",
    bearerToken: token
  };
};

const createMultipleTokensAuth = (tokens: string[]): MultipleTokensAuth => {
  return {
    method: "bearer_token",
    multipleTokens: true,
    tokensList: tokens
  };
};

const createBasicAuth = (username: string, password: string): BasicAuth => {
  return {
    method: "basic_auth",
    basicAuth: {
      username,
      password
    }
  };
};

const createMultipleBasicAuth = (
  credentials: Array<{username: string, password: string}>
): MultipleBasicAuth => {
  return {
    method: "basic_auth",
    multipleBasicAuth: true,
    basicAuthList: credentials
  };
};

const createSessionAuth = (
  loginUrl: string,
  method: 'GET' | 'POST' | 'PUT' = 'POST',
  credentials: Record<string, string>
): SessionCookieAuth => {
  return {
    method: "session_cookie",
    sessionCookie: {
      loginUrl,
      method,
      credentials
    }
  };
};

const createMultipleSessionAuth = (
  loginUrl: string,
  method: 'GET' | 'POST' | 'PUT' = 'POST',
  accountsList: Array<Record<string, string>>
): MultipleSessionAuth => {
  return {
    method: "session_cookie",
    sessionCookie: {
      loginUrl,
      method,
      credentials: {},
      multipleAccounts: true,
      accountsList
    }
  };
};

const createCustomHeadersAuth = (headers: Record<string, string>): CustomHeadersAuth => {
  return {
    method: "custom_headers",
    customHeaders: headers
  };
};

export function StressTestPanel() {
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const runRealConfigurationTest = async () => {
    setIsLoading(true);
    try {
      // Using our utility functions to create endpoint configs
      const appVersionEndpoint = createGetEndpoint('/api/app-version', 1.0, [
        { 
          path_params: {}, 
          query_params: {}, 
          request_body: {} 
        }
      ]);
      
      const profileEndpoint = createGetEndpoint('/api/user/{user_id}/profile', 1.0, [
        { 
          path_params: { user_id: "pass" }, 
          query_params: {}, 
          request_body: {} 
        }
      ]);
      
      // Create configuration exactly matching the review stage
      const realConfig: StressTestConfig = {
        target_url: "https://api.thebighalo.com",
        max_concurrent_users: 10,
        request_rate: 10,  // Default value from ReviewLaunchStep
        duration: 60,      // Default value from ReviewLaunchStep
        strategy: "sequential",
        endpoints: [appVersionEndpoint, profileEndpoint],
        // Using helper function for session auth
        authentication: createSessionAuth(
          "https://api.thebighalo.com/phone_auth/verify-otp",
          "POST",
          {
            phone: "1234567890",
            code: "123456"
          }
        )
      };
    
      console.log('Sending real configuration:', JSON.stringify(realConfig, null, 2));
      
      // Test with direct fetch
      const response = await fetch('/api/stress-test/task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await apiService.getAuthHeaders())
        },
        body: JSON.stringify({
          config: realConfig
        }),
      });

      const responseData = await response.json();
      console.log('API response:', response.status, responseData);
      
      setTestResult({
        status: response.status,
        success: response.ok,
        data: responseData
      });
    } catch (error) {
      console.error('Test API error:', error);
      setTestResult({
        status: 500,
        success: false,
        error: String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Test with a complex mix of endpoints
  const testComplexEndpoints = async () => {
    setIsLoading(true);
    try {
      // Create a variety of endpoint types with different data
      const endpoints: EndpointConfig[] = [
        // GET endpoint with query params
        createGetEndpoint('/api/products', 1.0, [
          { 
            path_params: {}, 
            query_params: { category: "electronics", limit: 10 }, 
            request_body: {} 
          }
        ]),
        
        // GET endpoint with path params
        createGetEndpoint('/api/products/{product_id}', 2.0, [
          { 
            path_params: { product_id: "12345" }, 
            query_params: {}, 
            request_body: {} 
          },
          { 
            path_params: { product_id: "67890" }, 
            query_params: {}, 
            request_body: {} 
          }
        ]),
        
        // POST endpoint with request body
        createPostEndpoint('/api/orders', 3.0, [
          { 
            path_params: {}, 
            query_params: {}, 
            request_body: { 
              product_id: "12345", 
              quantity: 2, 
              shipping_address: "123 Main St" 
            } 
          }
        ]),
        
        // Custom PUT endpoint
        {
          path: '/api/user/profile',
          method: 'PUT',
          weight: 0.5,
          content_type: 'application/json',
          has_body: true,
          test_data_samples: [
            {
              name: "Update User Profile",
              data: {
                path_params: {},
                query_params: {},
                request_body: {
                  name: "John Doe",
                  email: "john@example.com",
                  preferences: { theme: "dark", notifications: true }
                }
              }
            }
          ]
        }
      ];
      
      const complexConfig: StressTestConfig = {
        target_url: "https://api.example.com",
        max_concurrent_users: 15,
        request_rate: 5,
        duration: 30,
        strategy: "random",
        endpoints: endpoints,
        strategy_options: {
          random: {
            seed: 12345,
            distribution_pattern: "weighted"
          }
        },
        // Using custom headers auth for this test
        authentication: createCustomHeadersAuth({
          "X-Custom-Auth": "test-value",
          "X-API-Version": "1.0",
          "X-Client-ID": "test-client"
        })
      };
      
      console.log('Sending complex endpoints config:', JSON.stringify(complexConfig, null, 2));
      
      const response = await fetch('/api/stress-test/task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await apiService.getAuthHeaders())
        },
        body: JSON.stringify({
          config: complexConfig
        }),
      });

      const responseData = await response.json();
      console.log('API response (complex endpoints):', response.status, responseData);
      
      setTestResult({
        type: "complex-endpoints",
        status: response.status,
        success: response.ok,
        data: responseData
      });
    } catch (error) {
      console.error('Test API error:', error);
      setTestResult({
        type: "complex-endpoints",
        status: 500,
        success: false,
        error: String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add test functions for different authentication methods
  const testMultipleTokens = async () => {
    setIsLoading(true);
    try {
      // Using utility function to create endpoint
      const endpoint = createGetEndpoint('/api/app-version', 1.0);
      
      // Create configuration with multiple bearer tokens
      const tokenConfig: StressTestConfig = {
        target_url: "https://api.thebighalo.com",
        max_concurrent_users: 10,
        request_rate: 10,
        duration: 60,
        strategy: "sequential",
        endpoints: [endpoint],
        // Using helper function for multiple tokens
        authentication: createMultipleTokensAuth([
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        ])
      };
    
      console.log('Sending multiple tokens config:', JSON.stringify(tokenConfig, null, 2));
      
      const response = await fetch('/api/stress-test/task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await apiService.getAuthHeaders())
        },
        body: JSON.stringify({
          config: tokenConfig
        }),
      });

      const responseData = await response.json();
      console.log('API response (multiple tokens):', response.status, responseData);
      
      setTestResult({
        auth: "token-multiple",
        status: response.status,
        success: response.ok,
        data: responseData
      });
    } catch (error) {
      console.error('Test API error:', error);
      setTestResult({
        auth: "token-multiple",
        status: 500,
        success: false,
        error: String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const testApiKeyAuth = async () => {
    setIsLoading(true);
    try {
      // Using utility function to create endpoint
      const endpoint = createGetEndpoint('/api/app-version', 1.0);
      
      // Create configuration with API key auth
      const apiKeyConfig: StressTestConfig = {
        target_url: "https://api.thebighalo.com",
        max_concurrent_users: 5,
        request_rate: 5,
        duration: 30,
        strategy: "sequential",
        endpoints: [endpoint],
        // Using helper function for API key auth
        authentication: createApiKeyAuth(
          "X-API-Key",
          "a1b2c3d4e5f6g7h8i9j0",
          "header"
        )
      };
    
      console.log('Sending API key auth config:', JSON.stringify(apiKeyConfig, null, 2));
      
      const response = await fetch('/api/stress-test/task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await apiService.getAuthHeaders())
        },
        body: JSON.stringify({
          config: apiKeyConfig
        }),
      });

      const responseData = await response.json();
      console.log('API response (API key auth):', response.status, responseData);
      
      setTestResult({
        auth: "api-key",
        status: response.status,
        success: response.ok,
        data: responseData
      });
    } catch (error) {
      console.error('Test API error:', error);
      setTestResult({
        auth: "api-key",
        status: 500,
        success: false,
        error: String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const testBasicAuth = async () => {
    setIsLoading(true);
    try {
      // Using utility function to create endpoint
      const endpoint = createGetEndpoint('/api/app-version', 1.0);
      
      // Create configuration with multiple basic auth accounts
      const basicAuthConfig: StressTestConfig = {
        target_url: "https://api.thebighalo.com",
        max_concurrent_users: 10,
        request_rate: 10,
        duration: 60,
        strategy: "sequential",
        endpoints: [endpoint],
        // Multiple basic auth credentials
        authentication: createMultipleBasicAuth([
          { username: "user1", password: "pass1" },
          { username: "user2", password: "pass2" },
          { username: "user3", password: "pass3" }
        ])
      };
    
      console.log('Sending basic auth config:', JSON.stringify(basicAuthConfig, null, 2));
      
      const response = await fetch('/api/stress-test/task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await apiService.getAuthHeaders())
        },
        body: JSON.stringify({
          config: basicAuthConfig
        }),
      });

      const responseData = await response.json();
      console.log('API response (basic auth):', response.status, responseData);
      
      setTestResult({
        auth: "basic-auth",
        status: response.status,
        success: response.ok,
        data: responseData
      });
    } catch (error) {
      console.error('Test API error:', error);
      setTestResult({
        auth: "basic-auth",
        status: 500,
        success: false,
        error: String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testMultipleSessionAuth = async () => {
    setIsLoading(true);
    try {
      // Using utility function to create endpoint
      const endpoint = createGetEndpoint('/api/app-version', 1.0);
      
      // Create configuration with multiple session accounts
      const sessionAuthConfig: StressTestConfig = {
        target_url: "https://api.thebighalo.com",
        max_concurrent_users: 8,
        request_rate: 8,
        duration: 45,
        strategy: "sequential",
        endpoints: [endpoint],
        // Using helper function for multiple session accounts
        authentication: createMultipleSessionAuth(
          "https://api.thebighalo.com/login",
          "POST",
          [
            { username: "test1@example.com", password: "password1" },
            { username: "test2@example.com", password: "password2" },
            { username: "test3@example.com", password: "password3" }
          ]
        )
      };
    
      console.log('Sending multiple session auth config:', JSON.stringify(sessionAuthConfig, null, 2));
      
      const response = await fetch('/api/stress-test/task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await apiService.getAuthHeaders())
        },
        body: JSON.stringify({
          config: sessionAuthConfig
        }),
      });

      const responseData = await response.json();
      console.log('API response (multiple session auth):', response.status, responseData);
      
      setTestResult({
        auth: "session-multiple",
        status: response.status,
        success: response.ok,
        data: responseData
      });
    } catch (error) {
      console.error('Test API error:', error);
      setTestResult({
        auth: "session-multiple",
        status: 500,
        success: false,
        error: String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const runStressTestApiTest = async (strategy: 'sequential' | 'interleaved' | 'random') => {
    setIsLoading(true);
    try {
      // Create endpoints using utility functions
      const healthEndpoint = createGetEndpoint('/health', 1.0);
      const validateEndpoint = createPostEndpoint('/api/validate-target', 2.0, [
        {
          path_params: {},
          query_params: {},
          request_body: { target_url: "http://example.com" }
        }
      ]);
      
      // Create a complete test configuration with all fields
      const baseConfig: StressTestConfig = {
        target_url: "http://localhost:8000",
        max_concurrent_users: 5,
        request_rate: 2,
        duration: 10,
        strategy: strategy,
        endpoints: [healthEndpoint, validateEndpoint],
        use_random_session: false,
        query_params: {
          "test": "true",
          "debug": "1"
        }
      };
      
      // Add strategy-specific options
      let configWithStrategyOptions: StressTestConfig = { ...baseConfig };
      
      if (strategy === 'sequential') {
        configWithStrategyOptions.strategy_options = {
          sequential: {
            delay_between_requests_ms: 100,
            repeat_sequence: 2
          }
        };
      } else if (strategy === 'interleaved') {
        configWithStrategyOptions.strategy_options = {
          interleaved: {
            endpoint_distribution: {
              "GET /health": 30,
              "POST /api/validate-target": 70
            }
          }
        };
      } else if (strategy === 'random') {
        configWithStrategyOptions.strategy_options = {
          random: {
            seed: 12345,
            distribution_pattern: "weighted"
          }
        };
      }
      
      // Add authentication config (single account session)
      configWithStrategyOptions.authentication = createSessionAuth(
        "http://localhost:8000/api/login",
        "POST",
        {
          username: "testuser",
          password: "testpassword"
        }
      );
    
      // Use testStressTestAPI with our custom config
      const response = await fetch('/api/stress-test/task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await apiService.getAuthHeaders())
        },
        body: JSON.stringify({
          config: configWithStrategyOptions
        }),
      });

      const responseData = await response.json();
      console.log(`API response (${strategy}):`, response.status, responseData);
      
      setTestResult({
        strategy,
        status: response.status,
        success: response.ok,
        data: responseData
      });
    } catch (error) {
      console.error(`Test API error (${strategy}):`, error);
      setTestResult({
        strategy,
        status: 500,
        success: false,
        error: String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearResults = () => {
    setTestResult(null);
  };
  
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">API Stress Test Panel</h1>
      
      <div className="mb-6 p-4 border rounded shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Test Configuration</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <button 
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            onClick={runRealConfigurationTest}
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Test Real Configuration'}
          </button>
          <button 
            className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600"
            onClick={testComplexEndpoints}
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Test Complex Endpoints'}
          </button>
          <button 
            className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            onClick={clearResults}
          >
            Clear Results
          </button>
        </div>
      </div>
      
      <div className="mb-6 p-4 border rounded shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Authentication Methods</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <button 
            className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            onClick={testMultipleTokens}
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Test Multiple Tokens'}
          </button>
          <button 
            className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
            onClick={testBasicAuth}
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Test Basic Auth'}
          </button>
          <button 
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={testApiKeyAuth}
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Test API Key Auth'}
          </button>
          <button 
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={testMultipleSessionAuth}
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Test Multiple Sessions'}
          </button>
        </div>
      </div>
      
      <div className="mb-6 p-4 border rounded shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Distribution Strategy Tests</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <button 
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => runStressTestApiTest('sequential')}
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Test Sequential Strategy'}
          </button>
          <button 
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={() => runStressTestApiTest('interleaved')}
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Test Interleaved Strategy'}
          </button>
          <button 
            className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
            onClick={() => runStressTestApiTest('random')}
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Test Random Strategy'}
          </button>
        </div>
      </div>
        
      {testResult && (
        <div className="mt-4 p-4 border rounded shadow-sm">
          <h3 className="text-md font-medium mb-2">
            Test Results 
            {testResult.strategy ? ` (${testResult.strategy} strategy)` : ''}
            {testResult.auth ? ` (${testResult.auth})` : ''}
            {testResult.type ? ` (${testResult.type})` : ''}
          </h3>
          <div className="bg-gray-100 p-3 rounded overflow-auto max-h-96">
            <pre className="text-sm">{JSON.stringify(testResult, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
} 