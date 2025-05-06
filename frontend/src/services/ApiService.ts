import { EndpointSchema } from '../types/api';
import { supabase } from '../lib/supabase';

// Task status enum to match backend
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled'
}

// Interface for task submission and retrieval
export interface TaskSubmitResponse {
  task_id: string;
  status: TaskStatus;
  message: string;
}

export interface TaskStatusResponse {
  task_id: string;
  task_type: string;
  status: TaskStatus;
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  current_operation: string;
  error?: string;
  result?: any;
  user_id?: string;
}

export interface TaskListResponse {
  tasks: TaskStatusResponse[];
  total: number;
}

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
   * Get authentication headers for API requests
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
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
      const response = await fetch('/api/openapi-endpoints', {
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
   * Start a stress test (using task queue)
   * @param config Test configuration
   * @returns Task information
   */
  async startStressTest(config: any): Promise<TaskSubmitResponse> {
    try {
      // Ensure user_id is included if available
      const userId = await this.getCurrentUserId();
      if (userId) {
        config.user_id = userId;
      }
      
      // Create the task request
      const taskRequest = {
        user_id: userId,
        config: config
      };
      
      // Call the task-based endpoint
      const response = await fetch('/api/stress-test/task', {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(taskRequest),
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
   * Get the current user ID from Supabase
   * @returns User ID if available
   */
  private async getCurrentUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  }
  
  /**
   * Submit a generic task
   * @param taskType The type of task to submit
   * @param params Parameters for the task
   * @returns Task submission response
   */
  async submitTask(taskType: string, params: any): Promise<TaskSubmitResponse> {
    try {
      const userId = await this.getCurrentUserId();
      
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          task_type: taskType,
          params: params,
          user_id: userId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit task');
      }

      return await response.json();
    } catch (error) {
      console.error('Error submitting task:', error);
      throw error;
    }
  }
  
  /**
   * Get status of a task
   * @param taskId The ID of the task
   * @returns Task status
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get task status');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting task status:', error);
      throw error;
    }
  }
  
  /**
   * Get all tasks for a user
   * @param limit Maximum number of tasks to return
   * @param offset Pagination offset
   * @returns List of tasks
   */
  async getUserTasks(limit: number = 20, offset: number = 0): Promise<TaskListResponse> {
    try {
      const userId = await this.getCurrentUserId();
      
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch(`/api/users/${userId}/tasks?limit=${limit}&offset=${offset}`, {
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get user tasks');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting user tasks:', error);
      throw error;
    }
  }
  
  /**
   * Cancel a task
   * @param taskId The ID of the task to cancel
   * @returns Updated task status
   */
  async cancelTask(taskId: string): Promise<TaskStatusResponse> {
    try {
      const response = await fetch(`/api/tasks/${taskId}/cancel`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to cancel task');
      }

      return await response.json();
    } catch (error) {
      console.error('Error canceling task:', error);
      throw error;
    }
  }
  
  /**
   * Poll for task status until it completes or fails
   * @param taskId The ID of the task to poll
   * @param interval Polling interval in milliseconds
   * @param maxAttempts Maximum number of polling attempts
   * @param callback Optional callback for status updates
   * @returns Promise that resolves with the final task status
   */
  async pollTaskUntilCompletion(
    taskId: string, 
    interval: number = 1000, 
    maxAttempts: number = 300,
    callback?: (status: TaskStatusResponse) => void
  ): Promise<TaskStatusResponse> {
    return new Promise(async (resolve, reject) => {
      let attempts = 0;
      
      const poll = async () => {
        try {
          const status = await this.getTaskStatus(taskId);
          
          // Call the callback with current status if provided
          if (callback) {
            callback(status);
          }
          
          // Check if the task has completed or failed
          if (status.status === TaskStatus.COMPLETED || 
              status.status === TaskStatus.FAILED ||
              status.status === TaskStatus.CANCELED) {
            resolve(status);
            return;
          }
          
          // Check if we've reached the maximum number of attempts
          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error(`Task polling timed out after ${maxAttempts} attempts`));
            return;
          }
          
          // Continue polling
          setTimeout(poll, interval);
        } catch (error) {
          reject(error);
        }
      };
      
      // Start polling
      poll();
    });
  }

  /**
   * Validate a target API
   * @param targetUrl The URL of the target API
   * @returns Validation result
   */
  async validateTarget(targetUrl: string) {
    try {
      const response = await fetch('/api/validate-target', {
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
      const response = await fetch('/api/distribution-strategies', {
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
      const response = await fetch('/api/distribution-requirements', {
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
      const response = await fetch('/api/generate-sample-data', {
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
      
      const response = await fetch(`/api/user/${encodeURIComponent(email)}/sessions`, {
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
      
      const response = await fetch('/api/sessions/direct', {
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
      const response = await fetch(`/api/sessions/${sessionId}/configuration`, {
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
   * Get stress test results using the task system
   * @param testId The ID of the test/task
   * @returns Test results
   */
  async getStressTestResults(testId: string) {
    try {
      // First try to get the task status
      const taskStatus = await this.getTaskStatus(testId);
      
      // If task is complete and has results, return them
      if (taskStatus.result) {
        return {
          test_id: testId,
          status: taskStatus.status,
          results: taskStatus.result.results || {},
          summary: taskStatus.result.summary || {},
          config: taskStatus.result.config
        };
      }
      
      // If task is still running or doesn't have results, try the legacy endpoint
      console.log('Task results not available, trying legacy endpoint');
      const response = await fetch(`/api/stress-test/${testId}/results`, {
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get stress test results');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting stress test results:', error);
      throw error;
    }
  }

  /**
   * Stop a running stress test using the task system
   * @param testId The ID of the test/task to stop
   * @returns Stop result
   */
  async stopStressTest(testId: string) {
    try {
      // Use the task cancel endpoint
      return await this.cancelTask(testId);
    } catch (error) {
      console.error('Error stopping stress test:', error);
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
      // Try to get task status first
      try {
        const taskStatus = await this.getTaskStatus(testId);
        
        // Convert task status to progress format
        return {
          test_id: taskStatus.task_id,
          status: taskStatus.status,
          elapsed_time: 0, // Not directly available from task status
          completed_requests: 0, // Not directly available from task status
          progress: taskStatus.progress,
          results_available: !!taskStatus.result,
          current_operation: taskStatus.current_operation
        };
      } catch (e) {
        // Fall back to legacy endpoint
        const response = await fetch(`/api/stress-test/${testId}/progress`, {
          headers: await this.getAuthHeaders(),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to get test progress');
        }

        return await response.json();
      }
    } catch (error) {
      console.error('Error getting test progress:', error);
      throw error;
    }
  }

  // Add method to generate fake data for an endpoint
  async generateFakeData(baseUrl: string, method: string, path: string): Promise<any> {
    try {
      const response = await fetch('/api/generate-fake-data', {
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
}

export default ApiService.getInstance();
