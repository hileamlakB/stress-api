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
      const response = await fetch('/api/start-advanced-test', {
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
}

export default ApiService.getInstance();
