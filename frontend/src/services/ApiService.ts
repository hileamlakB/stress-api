import { EndpointSchema } from '../types/api';
import { supabase } from '../lib/supabase';

// API base URL - uses environment variable or default to production URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://stress-api-production.up.railway.app';

/**
 * Service for interacting with the backend API
 */
export class ApiService {
  private static instance: ApiService;
  
  private constructor() {}

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  /**
   * Get API URL based on the current environment
   * @param endpoint API endpoint path (should start with /)
   * @returns Full API URL
   */
  private getApiUrl(endpoint: string): string {
    // For local development, use relative URLs to leverage the Vite proxy
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return endpoint;
    }
    // For production, use the full API URL
    return `${API_BASE_URL}${endpoint}`;
  }

  /**
   * Get authentication headers for API requests
   */
  public async getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Get the current session
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    return headers;
  }

  /**
   * Fetch API endpoints from an OpenAPI specification
   * @param targetUrl The URL of the target API
   * @returns Array of endpoints
   */
  async fetchEndpoints(targetUrl: string): Promise<EndpointSchema[]> {
    try {
      const response = await fetch(this.getApiUrl('/api/openapi-endpoints'), {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ target_url: targetUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch endpoints');
      }

      const data = await response.json();
      return data.endpoints;
    } catch (error) {
      console.error('Error fetching endpoints:', error);
      throw error;
    }
  }

  /**
   * Start a stress test
   * @param config Test configuration
   * @returns Test ID and other info
   */
  async startStressTest(config: any) {
    try {
      // Format the request body according to the model expected by the backend
      const response = await fetch(this.getApiUrl('/api/advanced-test'), {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start stress test');
      }

      return await response.json();
    } catch (error) {
      console.error('Error starting stress test:', error);
      throw error;
    }
  }

  /**
   * Validate a target API
   * @param targetUrl The URL of the target API
   * @returns Validation result
   */
  async validateTarget(targetUrl: string) {
    try {
      const response = await fetch(this.getApiUrl('/api/validate-target'), {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ target_url: targetUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to validate target');
      }

      return await response.json();
    } catch (error) {
      console.error('Error validating target:', error);
      throw error;
    }
  }

  /**
   * Fetch available distribution strategies
   * @returns Array of distribution strategies
   */
  async fetchDistributionStrategies() {
    try {
      const response = await fetch(this.getApiUrl('/api/distribution-strategies'), {
        headers: await this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch distribution strategies');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching distribution strategies:', error);
      throw error;
    }
  }

  /**
   * Fetch distribution requirements for all strategies
   * @returns Map of strategy requirements
   */
  async fetchDistributionRequirements() {
    try {
      const response = await fetch(this.getApiUrl('/api/distribution-requirements'), {
        headers: await this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch distribution requirements');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching distribution requirements:', error);
      throw error;
    }
  }

  /**
   * Generate test data for an endpoint
   * @param endpoint The endpoint to generate data for
   * @returns Generated test data
   */
  async generateTestData(endpoint: EndpointSchema) {
    try {
      const response = await fetch(this.getApiUrl('/api/generate-sample-data'), {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(endpoint),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate test data');
      }

      return await response.json();
    } catch (error) {
      console.error('Error generating test data:', error);
      throw error;
    }
  }

  /**
   * Fetch user sessions and their configurations
   * @param email The email of the user
   * @returns User sessions data
   */
  async fetchUserSessions(email: string) {
    try {
      if (!email || !email.trim() || !email.includes('@')) {
        throw new Error('Invalid email address provided');
      }
      
      console.log(`Fetching sessions for user: ${email}`);
      
      const response = await fetch(this.getApiUrl(`/api/user/${encodeURIComponent(email)}/sessions`), {
        method: 'GET',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
      });

      // Specifically handle 404s - user not found
      if (response.status === 404) {
        throw new Error(`User not found for email: ${email}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Error fetching sessions: ${response.statusText || 'Unknown error'} (${response.status})`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (e) {
          // If parsing fails, use the raw text if available
          if (errorText) errorMessage += `: ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`Successfully fetched ${data.sessions?.length || 0} sessions for user: ${email}`);
      
      if (!data.user_id) {
        console.warn(`Warning: User ID missing in response for ${email}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching user sessions:', error);
      throw error;
    }
  }

  /**
   * Create a new test session with optional recurrence scheduling
   * @param email The email of the user to associate the session with
   * @param name The name of the session
   * @param description Optional description for the session
   * @param recurrence Optional recurrence settings for scheduling
   * @returns Created session
   */
  async createTestSession(
    email: string, 
    name: string, 
    description?: string,
    recurrence?: {
      type: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
      interval?: number;
      startDate?: string;
      startTime?: string;
    }
  ) {
    try {
      // Input validation
      if (!email || !email.includes('@')) {
        throw new Error('Invalid email address');
      }
      
      if (!name) {
        throw new Error('Test name is required');
      }
      
      console.log(`Creating test session for user: ${email} with name: ${name}`);
      
      // First try the direct session creation endpoint (new implementation)
      try {
        const directSession = await this.createDirectTestSession(email, name, description, recurrence);
        console.log('Successfully created test session using direct API');
        return directSession;
      } catch (directError) {
        console.error('Direct session creation failed:', directError);
        console.log('Trying fallback method...');
      }
      
      // Fallback to user lookup and creation flow
      let userId;
      
      try {
        // Try to get the user ID from the email
        const userData = await this.fetchUserSessions(email);
        userId = userData.user_id;
      } catch (error) {
        console.log(`User not found, creating a new user for email: ${email}`);
        // If user not found, create a new user
        const userResponse = await fetch('/api/users', {
          method: 'POST',
          headers: await this.getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify({
            email: email,
            name: email.split('@')[0], // Use part before @ as name
          }),
        });
        
        if (!userResponse.ok) {
          throw new Error('Failed to create user account');
        }
        
        const newUserData = await userResponse.json();
        userId = newUserData.id;
        console.log(`Created new user with ID: ${userId}`);
      }
      
      if (!userId) {
        throw new Error(`Cannot proceed: Unable to find or create user for email: ${email}`);
      }
      
      console.log(`User ID for test creation: ${userId}`);
      
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          user_id: userId,
          name,
          description,
          recurrence
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to create test session (${response.status})`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating test session:', error);
      throw error;
    }
  }

  /**
   * Create a test session directly with email (primary method)
   * This method uses the new API endpoint that handles user synchronization
   */
  async createDirectTestSession(
    email: string, 
    name: string, 
    description?: string,
    recurrence?: any
  ) {
    try {
      console.log(`Creating direct test session with email: ${email}, name: ${name}`);
      
      const response = await fetch(this.getApiUrl('/api/sessions/direct'), {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          email,
          name,
          description,
          recurrence
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to create direct test session (${response.status})`);
      }
      
      const data = await response.json();
      console.log('Direct test session created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating direct test session:', error);
      throw error;
    }
  }

  /**
   * Update a test session
   * @param sessionId The ID of the session to update
   * @param name New name for the session
   * @param description New description for the session
   * @param recurrence Optional recurrence settings for scheduling
   * @returns Updated session data
   */
  async updateTestSession(
    sessionId: string, 
    name: string, 
    description?: string,
    recurrence?: {
      type: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
      interval?: number;
      startDate?: string;
      startTime?: string;
    }
  ) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          name,
          description,
          recurrence
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update test session');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating test session:', error);
      throw error;
    }
  }

  /**
   * Delete a test session
   * @param sessionId The ID of the session to delete
   * @returns Success status
   */
  async deleteTestSession(sessionId: string) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete test session');
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting test session:', error);
      throw error;
    }
  }

  /**
   * Create a new session configuration
   * @param config The session configuration data
   * @param userEmail The email of the user to associate the session with
   * @returns Created session configuration
   */
  async createSessionConfiguration(config: any, userEmail: string) {
    try {
      const response = await fetch(`/api/sessions/configuration?user_email=${encodeURIComponent(userEmail)}`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create session configuration');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating session configuration:', error);
      throw error;
    }
  }

  /**
   * Update the state of a test session
   * @param sessionId The ID of the session to update
   * @param configData The session configuration data
   * @returns Updated session configuration
   */
  async updateSessionState(sessionId: string, configData: any) {
    try {
      const response = await fetch(this.getApiUrl(`/api/sessions/${sessionId}/configuration`), {
        method: 'PUT',
        headers: await this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(configData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update session state');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating session state:', error);
      throw error;
    }
  }

  /**
   * Get progress updates for a running stress test
   * @param testId The ID of the test to check
   * @returns Progress information including session acquisition status
   */
  async getTestProgress(testId: string) {
    try {
      const response = await fetch(this.getApiUrl(`/api/stress-test/${testId}/progress`), {
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get test progress');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting test progress:', error);
      throw error;
    }
  }

  /**
   * DEPRECATED: Use getTestProgress instead, which now includes auth_sessions
   * This method is kept for backward compatibility but does nothing
   * @param testId The ID of the test to check
   * @returns Empty session object
   */
  async getSessionStatus(testId: string) {
    console.warn('getSessionStatus is deprecated. Use getTestProgress instead which includes auth_sessions.');
    // Return an empty object compatible with SessionStatus interface
    return {
      test_id: testId,
      status: 'running',
      auth_type: 'none',
      acquired_sessions: []
    };
  }

  /**
   * Get test results for a completed test
   * @param testId The ID of the test to get results for
   * @returns Test results data
   */
  async getTestResults(testId: string) {
    try {
      const response = await fetch(this.getApiUrl(`/api/stress-test/${testId}/results`), {
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get test results');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting test results:', error);
      throw error;
    }
  }

  // Add method to generate fake data for an endpoint
  async generateFakeData(baseUrl: string, method: string, path: string): Promise<any> {
    try {
      const response = await fetch(this.getApiUrl('/api/generate-fake-data'), {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          url: baseUrl,
          method,
          path
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error generating fake data:', error);
      throw error;
    }
  }

  /**
   * Start a stress test task
   * @param config Test task configuration
   * @returns Test ID and status
   */
  async startStressTestTask(config: any) {
    try {
      // Format the request body according to the StressTestTaskRequest model expected by the backend
      const requestBody = {
        config: config.config || config,  // Use config.config if available, otherwise use the config directly
        test_id: config.test_id || null   // Include test_id if provided
      };

      const response = await fetch(this.getApiUrl('/api/stress-test/task'), {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start stress test task');
      }

      return await response.json();
    } catch (error) {
      console.error('Error starting stress test task:', error);
      throw error;
    }
  }

  /**
   * Stop a stress test
   * @param testId The ID of the test to stop
   * @returns Response with stop status
   */
  async stopStressTest(testId: string) {
    try {
      const response = await fetch(this.getApiUrl(`/api/stress-test/${testId}/stop`), {
        method: 'POST',
        headers: await this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to stop stress test');
      }

      return await response.json();
    } catch (error) {
      console.error('Error stopping stress test:', error);
      throw error;
    }
  }
}

export default ApiService.getInstance();

/**
 * Fetch complete test results for a specific test
 */
export async function fetchTestResults(testId: string) {
  try {
    // Determine if we should use a relative URL or the full API base URL
    const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
      ? '' 
      : API_BASE_URL;
    
    const response = await fetch(`${baseUrl}/api/stress-test/${testId}/results`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch test results');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching test results:', error);
    throw error;
  }
}
