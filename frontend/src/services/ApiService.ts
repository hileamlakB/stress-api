import { EndpointSchema } from '../types/api';

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
   * Fetch API endpoints from an OpenAPI specification
   * @param targetUrl The URL of the target API
   * @returns Array of endpoints
   */
  async fetchEndpoints(targetUrl: string): Promise<EndpointSchema[]> {
    try {
      const response = await fetch('/api/openapi-endpoints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch('/api/advanced-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch('/api/validate-target', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch('/api/distribution-strategies');
      
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
      const response = await fetch('/api/distribution-requirements');
      
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
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`http://localhost:8000/api/user/${encodeURIComponent(email)}/sessions`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        throw new Error(`Error fetching sessions: ${response.statusText || 'Unknown error'} (${response.status})`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching user sessions:', error);
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
      const response = await fetch(`http://localhost:8000/api/sessions/configuration?user_email=${encodeURIComponent(userEmail)}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
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
}

export default ApiService.getInstance();
