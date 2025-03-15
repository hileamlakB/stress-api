/**
 * Type definitions for API models used in the frontend
 */

export type ParameterSchema = {
  name: string;
  location: string;
  required: boolean;
  param_schema: Record<string, any>;
  description?: string;
};

export type ResponseSchema = {
  status_code: string;
  content_type: string;
  response_schema: Record<string, any>;
  description?: string;
};

export type EndpointSchema = {
  path: string;
  method: string;
  summary: string;
  parameters: ParameterSchema[];
  request_body?: Record<string, any>;
  responses: Record<string, ResponseSchema>;
  description?: string;
};

export type StressTestEndpointConfig = {
  path: string;
  method: string;
  weight?: number;
  custom_parameters?: Record<string, any>;
};

export type DistributionStrategy = 'sequential' | 'interleaved' | 'random';

export type StressTestConfig = {
  target_url: string;
  strategy: DistributionStrategy;
  max_concurrent_users: number;
  request_rate: number;
  duration: number;
  endpoints: StressTestEndpointConfig[];
  headers?: Record<string, string>;
  use_random_session?: boolean;
};

export type TestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stopped';

export type StressTestResponse = {
  test_id: string;
  status: TestStatus;
  config: StressTestConfig;
  start_time: string;
};
