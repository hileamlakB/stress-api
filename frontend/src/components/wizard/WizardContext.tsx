import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DistributionStrategy, StressTestEndpointConfig } from '../../types/api';

// Define authentication method types
export type AuthMethod = 
  | 'none' 
  | 'api_key' 
  | 'bearer_token' 
  | 'basic_auth' 
  | 'custom_headers'
  | 'session_cookie';

// Authentication configuration type
export interface AuthConfig {
  method: AuthMethod;
  apiKey?: {
    key: string;
    value: string;
    addTo: 'header' | 'query';
  };
  bearerToken?: string;
  multipleTokens?: boolean;
  tokensList?: string[];
  basicAuth?: {
    username: string;
    password: string;
  };
  multipleBasicAuth?: boolean;
  basicAuthList?: Array<{username: string, password: string}>;
  customHeaders?: Record<string, string>;
  sessionCookie?: {
    loginUrl: string;
    method: 'GET' | 'POST' | 'PUT';
    credentials: Record<string, string>;
    extractCookie?: boolean;
    multipleAccounts?: boolean;
    accountsList?: Array<Record<string, string>>;
  };
}

// Define the shape of our context
type WizardContextType = {
  // API Configuration
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  authJson: string;
  setAuthJson: (json: string) => void;
  
  // New authentication configuration
  authConfig: AuthConfig;
  setAuthConfig: (config: AuthConfig) => void;
  
  // Endpoints
  endpoints: Array<{
    method: string;
    path: string;
    summary: string;
    description?: string;
    parameters: Array<any>;
    responses: Record<string, any>;
  }>;
  setEndpoints: (endpoints: Array<any>) => void;
  selectedEndpoints: string[];
  setSelectedEndpoints: (endpoints: string[]) => void;
  activeEndpointTab: string;
  setActiveEndpointTab: (tab: string) => void;
  endpointMethodFilter: string;
  setEndpointMethodFilter: (filter: string) => void;
  
  // Test Configuration
  concurrentRequests: number;
  setConcurrentRequests: (requests: number) => void;
  distributionMode: DistributionStrategy;
  setDistributionMode: (mode: DistributionStrategy) => void;
  
  // Advanced Strategy Options
  strategyOptions: Record<string, any>;
  setStrategyOptions: (options: Record<string, any>) => void;
  showAdvancedOptions: boolean;
  setShowAdvancedOptions: (show: boolean) => void;
  
  // Endpoint Configurations
  endpointConfigs: Record<string, StressTestEndpointConfig>;
  setEndpointConfigs: (configs: Record<string, StressTestEndpointConfig>) => void;
  
  // Test Execution
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  activeTestId: string | null;
  setActiveTestId: (id: string | null) => void;
  
  // Validation functions
  validateAuthJson: (json: string) => boolean;
  
  // UI State
  currentStep: number;
  setCurrentStep: (step: number) => void;
};

// Create the context with a default undefined value
const WizardContext = createContext<WizardContextType | undefined>(undefined);

// Provider component
type WizardProviderProps = {
  children: ReactNode;
};

export function WizardProvider({ children }: WizardProviderProps) {
  // API Configuration state
  const [baseUrl, setBaseUrl] = useState('');
  const [authJson, setAuthJson] = useState('');
  
  // New authentication configuration state
  const [authConfig, setAuthConfig] = useState<AuthConfig>({
    method: 'none'
  });
  
  // Endpoints state
  const [endpoints, setEndpoints] = useState<Array<any>>([]);
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([]);
  const [activeEndpointTab, setActiveEndpointTab] = useState<string>('all');
  const [endpointMethodFilter, setEndpointMethodFilter] = useState<string>('all');
  
  // Test configuration state
  const [concurrentRequests, setConcurrentRequests] = useState(10);
  const [distributionMode, setDistributionMode] = useState<DistributionStrategy>('sequential');
  
  // Advanced options state
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [strategyOptions, setStrategyOptions] = useState<Record<string, any>>({
    sequential: { 
      sequential_delay: 100, 
      sequential_repeat: 1
    },
    interleaved: { 
      endpoint_distribution: {} 
    },
    random: { 
      random_seed: undefined, 
      random_distribution_pattern: 'uniform' 
    }
  });
  
  // Endpoint configuration state
  const [endpointConfigs, setEndpointConfigs] = useState<Record<string, StressTestEndpointConfig>>({});
  
  // Test execution state
  const [isLoading, setIsLoading] = useState(false);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  
  // UI state
  const [currentStep, setCurrentStep] = useState(0);
  
  // Validation functions
  const validateAuthJson = (json: string): boolean => {
    if (!json.trim()) {
      return true; // Empty is valid
    }
    
    try {
      JSON.parse(json);
      return true;
    } catch (error) {
      return false;
    }
  };
  
  // Create the context value
  const value = {
    baseUrl,
    setBaseUrl,
    authJson,
    setAuthJson,
    authConfig,
    setAuthConfig,
    endpoints,
    setEndpoints,
    selectedEndpoints,
    setSelectedEndpoints,
    activeEndpointTab,
    setActiveEndpointTab,
    endpointMethodFilter,
    setEndpointMethodFilter,
    concurrentRequests,
    setConcurrentRequests,
    distributionMode,
    setDistributionMode,
    strategyOptions,
    setStrategyOptions,
    showAdvancedOptions,
    setShowAdvancedOptions,
    endpointConfigs,
    setEndpointConfigs,
    isLoading,
    setIsLoading,
    activeTestId,
    setActiveTestId,
    validateAuthJson,
    currentStep,
    setCurrentStep,
  };
  
  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}

// Custom hook to use the wizard context
export function useWizard() {
  const context = useContext(WizardContext);
  if (context === undefined) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
} 