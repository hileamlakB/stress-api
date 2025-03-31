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

// Data generation strategy types
export type DataGenerationStrategy = 'random_each_time' | 'consistent_random' | 'user_defined';

// Type for endpoint test data sample
export type EndpointTestDataSample = {
  path_parameters?: Record<string, any>;
  query_parameters?: Record<string, any>;
  headers?: Record<string, any>;
  body?: Record<string, any>;
};

// Response from the endpoint test data generation API
export type EndpointTestDataResponse = {
  endpoint_key: string;
  data_samples: EndpointTestDataSample[];
  timestamp: string;
};

export type StressTestEndpointConfig = {
  path: string;
  method: string;
  weight?: number;
  custom_parameters?: Record<string, any>;
  data_strategy?: DataGenerationStrategy;
  test_data_samples?: EndpointTestDataSample[];
};

export type DistributionStrategy = 'sequential' | 'interleaved' | 'random';

// New types for strategy requirements
export type RequirementFieldType = 'number' | 'boolean' | 'string' | 'select';

export type RequirementField = {
  type: RequirementFieldType;
  label: string;
  description: string;
  default_value: any;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
};

export type EndpointRequirementType = 'percentage' | 'rate' | 'weight';
export type DefaultDistributionType = 'even' | 'weighted' | 'custom';

export type EndpointRequirement = {
  type: EndpointRequirementType;
  description: string;
  must_total?: number;
  default_distribution: DefaultDistributionType;
};

export type StrategyRequirements = {
  name: string;
  description: string;
  general_requirements: Record<string, RequirementField>;
  endpoint_specific_requirements: boolean;
  endpoint_requirements?: EndpointRequirement;
};

export type DistributionRequirementsResponse = {
  strategies: Record<string, StrategyRequirements>;
};

// Types for strategy-specific options
export type SequentialOptions = {
  delay_between_requests_ms?: number;
  repeat_sequence?: number;
};

export type InterleavedOptions = {
  round_robin_batch_size?: number;
  endpoint_distribution?: Record<string, number>; // Maps endpoint to percentage
};

export type RandomOptions = {
  seed?: number;
  distribution_pattern?: 'uniform' | 'weighted' | 'gaussian';
  rate_limit_per_endpoint?: Record<string, number>; // Maps endpoint to rate limit
};

export type StrategyOptions = {
  sequential?: SequentialOptions;
  interleaved?: InterleavedOptions;
  random?: RandomOptions;
};

export type StressTestConfig = {
  target_url: string;
  strategy: DistributionStrategy;
  strategy_options?: StrategyOptions;
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
