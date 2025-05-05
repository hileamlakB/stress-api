import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWizard } from '../WizardContext';
import { Button } from '../../Button';
import { Plus, Trash2, Repeat, Edit, RefreshCw, CheckCircle, Info, CornerDownRight } from 'lucide-react';
import apiService from '../../../services/ApiService';

export interface TestDataConfig {
  endpointKey: string;
  datasets: Array<{
    id: string;
    name: string;
    data: Record<string, any>;
    frequency?: number; // How often to use this dataset (percentage)
  }>;
}

// Map of endpoint key -> endpoint data configs
export type TestDataConfigs = Record<string, TestDataConfig>;

// Add this validate function to help the wizard validate this step
export function validateTestData(selectedEndpoints: string[], testDataConfigs: TestDataConfigs): { valid: boolean; message?: string } {
  // If no endpoints are selected, validation fails
  if (!selectedEndpoints || selectedEndpoints.length === 0) {
    return { valid: false, message: 'No endpoints selected. Please go back and select endpoints.' };
  }

  // Check that each selected endpoint has at least one dataset
  for (const endpoint of selectedEndpoints) {
    const config = testDataConfigs[endpoint];
    if (!config || !config.datasets || config.datasets.length === 0) {
      return { 
        valid: false, 
        message: `The endpoint ${endpoint} has no test data configured. Please add at least one test data sample.`
      };
    }
  }

  return { valid: true };
}

export function TestDataStep({ onStepNext }: { onStepNext?: () => void } = {}) {
  const { 
    selectedEndpoints, 
    endpoints,
    baseUrl,
    endpointConfigs: contextEndpointConfigs,
    setEndpointConfigs 
  } = useWizard();

  // Local state for test data configurations
  const [testDataConfigs, setTestDataConfigs] = useState<TestDataConfigs>({});
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);
  const [generatingData, setGeneratingData] = useState<Record<string, boolean>>({});
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [editingDataset, setEditingDataset] = useState<{
    id: string;
    name: string;
    data: Record<string, any>;
    frequency?: number;
  } | null>(null);
  const [showMultipleDialog, setShowMultipleDialog] = useState(false);
  const [duplicatingDataset, setDuplicatingDataset] = useState<string | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(1);
  const [duplicateSourceName, setDuplicateSourceName] = useState('');

  // Ref to track if we've already triggered data generation
  const dataGenerationTriggered = React.useRef(false);
  // Ref to track if we've already initialized data for the current session
  const hasInitialized = React.useRef(false);

  // Effect to set active endpoint when component mounts or selected endpoints change
  useEffect(() => {
    if (selectedEndpoints.length > 0 && !activeEndpoint) {
      setActiveEndpoint(selectedEndpoints[0]);
    }
  }, [selectedEndpoints, activeEndpoint]);

  // Initialize from context if available - with better state management
  useEffect(() => {
    // Don't run this effect if we've already initialized for this session
    if (hasInitialized.current) {
      return;
    }
    
    console.log("Initializing test data configs from context");
    
    // Track which endpoints need data generation
    const initialConfigs: TestDataConfigs = {};
    const endpointsNeedingData: string[] = [];
    
    if (contextEndpointConfigs) {
      // First pass: Check which endpoints already have test data either in context or local state
      for (const endpoint of selectedEndpoints) {
        // Check if we already have this endpoint in our local state with valid datasets
        const localConfig = testDataConfigs[endpoint];
        const hasLocalData = localConfig && 
                            localConfig.datasets && 
                            localConfig.datasets.length > 0;
        
        if (hasLocalData) {
          // We already have data for this endpoint in local state, keep it
          initialConfigs[endpoint] = localConfig;
          console.log(`Using existing local data for ${endpoint}`);
          continue;
        }
        
        // Otherwise check if context has data for this endpoint
        const contextConfig = contextEndpointConfigs[endpoint];
        // @ts-ignore - testData property exists at runtime but not in type definition
        const hasContextData = contextConfig && contextConfig.testData && contextConfig.testData.length > 0;
        
        if (hasContextData) {
          // Use the data from context
          initialConfigs[endpoint] = {
            endpointKey: endpoint,
            // @ts-ignore - testData property exists at runtime but not in type definition
            datasets: contextConfig.testData
          };
          console.log(`Using context data for ${endpoint}`);
        } else {
          // This endpoint needs data generation
          endpointsNeedingData.push(endpoint);
          console.log(`No data found for ${endpoint}, will generate`);
        }
      }
    } else {
      // No context configs at all, so all endpoints need data
      endpointsNeedingData.push(...selectedEndpoints);
    }
    
    // Update state with all existing configs first
    if (Object.keys(initialConfigs).length > 0) {
      console.log(`Setting initial configs for ${Object.keys(initialConfigs).length} endpoints`);
      setTestDataConfigs(initialConfigs);
    }
    
    // Mark that we've initialized
    hasInitialized.current = true;
    
    // Only generate data for endpoints that don't have any
    if (endpointsNeedingData.length > 0 && selectedEndpoints.length > 0 && baseUrl) {
      // Avoid repeating the same generation
      if (!dataGenerationTriggered.current) {
        console.log(`Will generate data for ${endpointsNeedingData.length} endpoints`);
        dataGenerationTriggered.current = true;
        
        // Use a timeout to ensure state has been updated first
        setTimeout(() => {
          generateDataForEndpoints(endpointsNeedingData);
        }, 100);
      }
    } else {
      console.log("No endpoints need data generation");
      // Ensure context is synced with our current state
      syncConfigsToContext();
    }
    
    // Reset initialization when component unmounts
    return () => {
      dataGenerationTriggered.current = false;
    };
  }, [selectedEndpoints, baseUrl]); // Only re-run when these key dependencies change

  // Function to sync test data configs to context
  const syncConfigsToContext = useCallback(() => {
    console.log("Syncing test data configs to context");
    
    // Make sure we don't overwrite other configs
    const updatedConfigs = { ...contextEndpointConfigs };
    
    // Track how many endpoints we actually sync
    let syncCount = 0;
    
    for (const [endpointKey, config] of Object.entries(testDataConfigs)) {
      // Skip syncing if the config has no datasets or empty datasets
      if (!config || !config.datasets || config.datasets.length === 0) {
        console.log(`Skipping sync for ${endpointKey} - no valid datasets`);
        continue;
      }
      
      syncCount++;
      
      // Create or update the endpoint config
      if (!updatedConfigs[endpointKey]) {
        // @ts-ignore - endpointKey and testData properties are added at runtime
        updatedConfigs[endpointKey] = {
          endpointKey,
          testData: config.datasets
        };
      } else {
        // @ts-ignore - testData property is added at runtime
        updatedConfigs[endpointKey] = {
          ...updatedConfigs[endpointKey],
          testData: config.datasets
        };
      }
    }
    
    // Only update context if we actually have data to sync
    if (syncCount > 0) {
      console.log(`Synced ${syncCount} endpoints to context`);
      setEndpointConfigs(updatedConfigs);
    } else {
      console.log("No valid test data to sync to context");
    }
  }, [testDataConfigs, contextEndpointConfigs, setEndpointConfigs]);

  // Call syncConfigsToContext when moving to the next step
  useEffect(() => {
    if (!onStepNext) return;
    
    // Store the original function
    const originalOnStepNext = onStepNext;
    
    // Replace the original function
    // @ts-ignore - extending the function
    onStepNext = () => {
      // Ensure hasInitialized is reset so data will be reloaded if we come back
      hasInitialized.current = false;
      
      // First sync the current configs to context
      console.log("Moving to next step - syncing all test data to context");
      syncConfigsToContext();
      
      // Give the context time to update before proceeding
      return originalOnStepNext();
    };
    
    // Return cleanup function to prevent memory leaks
    return () => {
      // @ts-ignore - cleanup
      onStepNext = originalOnStepNext;
    };
  }, [onStepNext, syncConfigsToContext]);

  // Get the currently selected endpoint object
  const currentEndpoint = useMemo(() => {
    if (!activeEndpoint) return null;
    
    const [method, path] = activeEndpoint.split(' ');
    return endpoints.find(e => e.method === method && e.path === path) || null;
  }, [activeEndpoint, endpoints]);

  // Get the current test data config for the active endpoint
  const currentConfig = useMemo(() => {
    if (!activeEndpoint) return null;
    return testDataConfigs[activeEndpoint] || null;
  }, [activeEndpoint, testDataConfigs]);

  // Handle generating fake data for the active endpoint
  const handleGenerateData = async (endpointKey: string) => {
    if (!endpointKey || !baseUrl) return;
    
    // Skip if already generating data for this endpoint
    if (generatingData[endpointKey]) {
      console.log(`Already generating data for ${endpointKey}, skipping duplicate request`);
      return;
    }
    
    // Skip if we already have data for this endpoint
    const existingConfig = testDataConfigs[endpointKey];
    if (existingConfig && existingConfig.datasets && existingConfig.datasets.length > 0) {
      console.log(`Data already exists for ${endpointKey}, skipping generation`);
      return;
    }
    
    // Set loading state for this endpoint
    setGeneratingData(prev => ({ ...prev, [endpointKey]: true }));
    
    try {
      console.log(`Generating data for ${endpointKey}`);
      const [method, path] = endpointKey.split(' ');
      
      // Find the endpoint details from the endpoints array
      const endpoint = endpoints.find(e => e.method === method && e.path === path);
      if (!endpoint) {
        throw new Error(`Endpoint ${endpointKey} not found`);
      }
      
      // Call API to generate fake data for this endpoint
      const response = await apiService.generateFakeData(baseUrl, method, path);
      
      if (response && response.samples) {
        // Get the existing config
        const existingConfig = testDataConfigs[endpointKey] || { endpointKey, datasets: [] };
        
        // Create a new dataset with sequential numbering
        const sampleNumber = existingConfig.datasets.length + 1;
        const newDataset = {
          id: `dataset_${Date.now()}`,
          name: `Sample Data ${sampleNumber}`,
          data: {
            headers: response.samples.headers || {},
            path_params: response.samples.path_params || {},
            query_params: response.samples.query_params || {},
            request_body: response.samples.request_body || {}
          },
          frequency: 1
        };
        
        // Update the test data config for this endpoint, REPLACING any previous data
        const updatedTestDataConfigs = {
          ...testDataConfigs,
          [endpointKey]: {
            endpointKey,
            datasets: [...existingConfig.datasets, newDataset]
          }
        };
        
        setTestDataConfigs(updatedTestDataConfigs);
        
        // Sync the updated configs to context immediately
        setTimeout(() => {
          console.log("Syncing newly generated data to context");
          syncConfigsToContext();
        }, 100);
        
        // Set active dataset to the newly created one
        setActiveDatasetId(newDataset.id);
      }
    } catch (error) {
      console.error(`Error generating data for endpoint ${endpointKey}:`, error);
      
      // Generate some fallback data intelligently based on endpoint path
      const [method, path] = endpointKey.split(' ');
      const pathParams: Record<string, string> = {};
      const queryParams: Record<string, string> = {};
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json"
      };
      let requestBody = {};
      
      // Extract path parameters from the URL and generate reasonable values
      const pathParamMatches = path.match(/{([^}]+)}/g);
      if (pathParamMatches) {
        pathParamMatches.forEach(match => {
          const paramName = match.slice(1, -1); // Remove { and }
          
          // Generate appropriate values based on parameter name
          if (paramName.includes('id')) {
            // For any ID fields, use a realistic looking ID
            pathParams[paramName] = Math.floor(Math.random() * 10000).toString();
          } else if (paramName.includes('date')) {
            // For date fields, use an ISO date
            const date = new Date();
            pathParams[paramName] = date.toISOString().split('T')[0];
          } else if (paramName.includes('uuid')) {
            // For UUID fields, generate a fake UUID
            pathParams[paramName] = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });
          } else {
            // For other fields, use a generic value
            pathParams[paramName] = `sample_${paramName}`;
          }
        });
      }
      
      // Generate sample request body if it's a write method
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        // Get the endpoint from our endpoints array to check its parameters
        const endpoint = endpoints.find(e => e.method === method && e.path === path);
        
        if (endpoint && endpoint.parameters) {
          // Check for body parameters
          const bodyParams = endpoint.parameters.filter(p => p.location === 'body');
          if (bodyParams.length > 0) {
            requestBody = generateSampleBody(bodyParams);
          } else {
            // Generic sample body based on the endpoint name
            const resourceName = extractResourceFromPath(path);
            if (resourceName) {
              requestBody = generateResourceBody(resourceName);
            } else {
              // Generic sample object
              requestBody = {
                "sample": "data", 
                "number": 123,
                "boolean": true
              };
            }
          }
        }
      }
      
      // Get the existing config
      const existingConfig = testDataConfigs[endpointKey] || { endpointKey, datasets: [] };
      
      // Create a new dataset with sequential numbering
      const sampleNumber = existingConfig.datasets.length + 1;
      
      // Create a fallback dataset with our generated values
      const fallbackDataset = {
        id: `dataset_${Date.now()}`,
        name: `Sample Data ${sampleNumber}`,
        data: {
          headers: headers,
          path_params: pathParams,
          query_params: queryParams,
          request_body: requestBody
        },
        frequency: 1
      };
      
      // Update test data configs, appending the new dataset
      const updatedTestDataConfigs = {
        ...testDataConfigs,
        [endpointKey]: {
          endpointKey,
          datasets: [...existingConfig.datasets, fallbackDataset]
        }
      };
      
      setTestDataConfigs(updatedTestDataConfigs);
      
      // Sync the updated configs to context immediately with fallback data
      setTimeout(() => {
        console.log("Syncing fallback generated data to context");
        syncConfigsToContext();
      }, 100);
      
      setActiveDatasetId(fallbackDataset.id);
    } finally {
      // Clear loading state
      setGeneratingData(prev => ({ ...prev, [endpointKey]: false }));
    }
  };
  
  // Helper function to extract resource name from path
  const extractResourceFromPath = (path: string): string | null => {
    // Extract the resource name from a path like /api/users/{id} -> "user"
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 0) {
      // Find the most likely resource name (usually the last non-parameter part)
      for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        if (!part.includes('{')) {
          // Convert to singular form if plural
          return part.endsWith('s') ? part.slice(0, -1) : part;
        }
      }
    }
    return null;
  };
  
  // Helper function to generate a sample body for a resource
  const generateResourceBody = (resourceName: string): Record<string, any> => {
    const body: Record<string, any> = {};
    
    // Common fields for different resource types
    switch (resourceName.toLowerCase()) {
      case 'user':
        body.name = 'John Doe';
        body.email = 'user@example.com';
        body.username = 'johndoe';
        break;
      case 'product':
        body.name = 'Sample Product';
        body.price = 99.99;
        body.description = 'This is a sample product description';
        break;
      case 'order':
        body.order_id = '12345';
        body.customer_id = '67890';
        body.items = [{ product_id: '1', quantity: 2 }];
        break;
      case 'comment':
        body.content = 'This is a sample comment';
        body.author_id = '12345';
        break;
      case 'task':
        body.title = 'Sample Task';
        body.description = 'This is a sample task';
        body.status = 'pending';
        break;
      default:
        // Generic fields
        body.name = `Sample ${resourceName}`;
        body.description = `This is a sample ${resourceName}`;
        body.id = Math.floor(Math.random() * 10000).toString();
    }
    
    return body;
  };
  
  // Helper function to generate sample body from parameter schema
  const generateSampleBody = (parameters: any[]): Record<string, any> => {
    const body: Record<string, any> = {};
    
    parameters.forEach(param => {
      if (param.param_schema) {
        const schema = param.param_schema;
        const type = schema.type || 'string';
        
        switch (type) {
          case 'string':
            if (schema.format === 'date-time' || schema.format === 'date') {
              body[param.name] = new Date().toISOString();
            } else if (schema.format === 'email') {
              body[param.name] = 'user@example.com';
            } else if (schema.format === 'uuid') {
              body[param.name] = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
              });
            } else {
              body[param.name] = `Sample ${param.name}`;
            }
            break;
          case 'number':
          case 'integer':
            body[param.name] = Math.floor(Math.random() * 100);
            break;
          case 'boolean':
            body[param.name] = Math.random() > 0.5;
            break;
          case 'array':
            body[param.name] = [];
            break;
          case 'object':
            body[param.name] = {};
            break;
        }
      }
    });
    
    return body;
  };

  // Auto-generate data for all endpoints
  const autoGenerateAllEndpointData = async () => {
    console.log('Auto-generating data for all endpoints');
    
    // Create an array of promises for data generation
    const generatePromises = selectedEndpoints.map(async (endpoint) => {
      // Check if we already have data for this endpoint
      if (!testDataConfigs[endpoint] || !testDataConfigs[endpoint].datasets || testDataConfigs[endpoint].datasets.length === 0) {
        console.log(`Generating data for endpoint: ${endpoint}`);
        await handleGenerateData(endpoint);
      } else {
        console.log(`Skipping data generation for endpoint ${endpoint} - data already exists`);
      }
    });
    
    // Wait for all data generation to complete
    await Promise.all(generatePromises);
    
    // Ensure we sync all the generated data to the context
    console.log("All endpoint data generation complete - syncing to context");
    syncConfigsToContext();
  };
  
  // Generate data for specific endpoints
  const generateDataForEndpoints = async (endpointKeys: string[]) => {
    console.log(`Generating data for ${endpointKeys.length} endpoints`);
    
    // Create an array of promises for data generation
    const generatePromises = endpointKeys.map(async (endpoint) => {
      // Double-check if we really need to generate data
      if (!testDataConfigs[endpoint] || !testDataConfigs[endpoint].datasets || testDataConfigs[endpoint].datasets.length === 0) {
        console.log(`Generating data for endpoint: ${endpoint}`);
        await handleGenerateData(endpoint);
      } else {
        console.log(`Skipping data generation for endpoint ${endpoint} - data already exists`);
      }
    });
    
    // Wait for all data generation to complete
    await Promise.all(generatePromises);
    
    // Ensure we sync all the generated data to the context
    console.log("All endpoint data generation complete - syncing to context");
    syncConfigsToContext();
  };

  // Handle adding a new dataset for the active endpoint
  const handleAddDataset = (endpointKey: string) => {
    if (!endpointKey) return;
    
    // Generate smart defaults based on the endpoint 
    const [method, path] = endpointKey.split(' ');
    const pathParams: Record<string, string> = {};
    const queryParams: Record<string, string> = {};
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    let requestBody = {};
    
    // Extract path parameters from the URL and generate reasonable values
    const pathParamMatches = path.match(/{([^}]+)}/g);
    if (pathParamMatches) {
      pathParamMatches.forEach(match => {
        const paramName = match.slice(1, -1); // Remove { and }
        
        // Generate appropriate values based on parameter name
        if (paramName.includes('id')) {
          // For any ID fields, use a realistic looking ID
          pathParams[paramName] = Math.floor(Math.random() * 10000).toString();
        } else if (paramName.includes('date')) {
          // For date fields, use an ISO date
          const date = new Date();
          pathParams[paramName] = date.toISOString().split('T')[0];
        } else if (paramName.includes('uuid')) {
          // For UUID fields, generate a fake UUID
          pathParams[paramName] = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        } else {
          // For other fields, use a generic value
          pathParams[paramName] = `sample_${paramName}`;
        }
      });
    }
    
    // Generate sample request body if it's a write method
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      // Get the endpoint from our endpoints array to check its parameters
      const endpoint = endpoints.find(e => e.method === method && e.path === path);
      
      if (endpoint && endpoint.parameters) {
        // Check for body parameters
        const bodyParams = endpoint.parameters.filter(p => p.location === 'body');
        if (bodyParams.length > 0) {
          requestBody = generateSampleBody(bodyParams);
        } else {
          // Generic sample body based on the endpoint name
          const resourceName = extractResourceFromPath(path);
          if (resourceName) {
            requestBody = generateResourceBody(resourceName);
          } else {
            // Generic sample object
            requestBody = {
              "sample": "data", 
              "number": 123,
              "boolean": true
            };
          }
        }
      }
    }
    
    // Get existing config to determine sample number
    const existingConfig = testDataConfigs[endpointKey] || { endpointKey, datasets: [] };
    const sampleNumber = existingConfig.datasets.length + 1;
    
    const newDataset = {
      id: `dataset_${Date.now()}`,
      name: `Sample Data ${sampleNumber}`,
      data: {
        headers: headers,
        path_params: pathParams,
        query_params: queryParams,
        request_body: requestBody
      },
      frequency: 1
    };
    
    setTestDataConfigs(prev => {
      const config = prev[endpointKey] || { endpointKey, datasets: [] };
      return {
        ...prev,
        [endpointKey]: {
          ...config,
          datasets: [...config.datasets, newDataset]
        }
      };
    });
    
    setActiveDatasetId(newDataset.id);
    setEditingDataset(newDataset);
  };

  // Handle deleting a dataset
  const handleDeleteDataset = (endpointKey: string, datasetId: string) => {
    if (!endpointKey || !datasetId) return;
    
    console.log(`Deleting dataset ${datasetId} from endpoint ${endpointKey}`);
    
    setTestDataConfigs(prev => {
      const config = prev[endpointKey];
      if (!config) return prev;
      
      // Filter out the dataset to be deleted
      const updatedDatasets = config.datasets.filter(ds => ds.id !== datasetId);
      
      console.log(`Remaining datasets: ${updatedDatasets.length}`);
      
      // Rename the datasets sequentially
      const renamedDatasets = updatedDatasets.map((ds, index) => ({
        ...ds,
        name: `Sample Data ${index + 1}`
      }));
      
      return {
        ...prev,
        [endpointKey]: {
          ...config,
          datasets: renamedDatasets
        }
      };
    });
    
    // If active dataset was deleted, set active to null
    if (activeDatasetId === datasetId) {
      setActiveDatasetId(null);
    }
  };

  // Handle saving dataset edits
  const handleSaveDataset = (endpointKey: string, dataset: any) => {
    if (!endpointKey || !dataset) return;
    
    setTestDataConfigs(prev => {
      const config = prev[endpointKey];
      if (!config) return prev;
      
      const updatedDatasets = config.datasets.map(ds => 
        ds.id === dataset.id ? dataset : ds
      );
      
      return {
        ...prev,
        [endpointKey]: {
          ...config,
          datasets: updatedDatasets
        }
      };
    });
    
    setEditingDataset(null);
  };

  // Format data for display
  const formatDataForDisplay = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return '{}';
    }
  };

  // Check if an endpoint has path parameters
  const hasPathParams = (endpoint: string) => {
    const [, path] = endpoint.split(' ');
    return path.includes('{') && path.includes('}');
  };

  // Check if an endpoint has a request body
  const hasRequestBody = (endpoint: string) => {
    const [method] = endpoint.split(' ');
    return ['POST', 'PUT', 'PATCH'].includes(method);
  };

  // Update replicateSample to handle multiple duplications
  const replicateSample = (endpointKey: string, sampleId: string, count: number = 1) => {
    if (!endpointKey || !sampleId || count < 1) return;

    // Find the sample to replicate
    const config = testDataConfigs[endpointKey];
    if (!config) return;

    const sampleToReplicate = config.datasets.find(ds => ds.id === sampleId);
    if (!sampleToReplicate) return;

    // Define proper type for newSamples
    const newSamples: Array<{
      id: string;
      name: string;
      data: Record<string, any>;
      frequency?: number;
    }> = [];
    
    // Create the specified number of duplicates
    for (let i = 0; i < count; i++) {
      // Fix the type issue with sampleNumber
      const nextSampleNumber = config.datasets.length + i + 1;
      newSamples.push({
        id: `dataset_${Date.now()}_${i}`,
        name: `Sample Data ${nextSampleNumber}`,
        data: { ...sampleToReplicate.data },
        frequency: sampleToReplicate.frequency || 1
      });
    }

    // Add all the new datasets
    setTestDataConfigs(prev => {
      const existingConfig = prev[endpointKey];
      return {
        ...prev,
        [endpointKey]: {
          ...existingConfig,
          datasets: [...existingConfig.datasets, ...newSamples]
        }
      };
    });

    // Set the last created sample as active
    if (newSamples.length > 0) {
      setActiveDatasetId(newSamples[newSamples.length - 1].id);
    }
  };

  // Add a function to generate multiple samples at once
  const generateMultipleSamples = async (endpointKey: string, count: number) => {
    if (!endpointKey || count <= 0) return;

    // Sequential generation to avoid race conditions
    for (let i = 0; i < count; i++) {
      await handleGenerateData(endpointKey);
    }
  };

  // Add a function to update the frequency/weight of a sample
  const updateSampleFrequency = (endpointKey: string, sampleId: string, frequency: number) => {
    setTestDataConfigs(prev => {
      const config = prev[endpointKey];
      if (!config) return prev;

      // Update the frequency for the specific sample
      const updatedDatasets = config.datasets.map(ds => 
        ds.id === sampleId ? { ...ds, frequency } : ds
      );

      return {
        ...prev,
        [endpointKey]: {
          ...config,
          datasets: updatedDatasets
        }
      };
    });
  };

  // Add DuplicateDialog component
  const DuplicateDialog = ({ 
    isOpen, 
    onClose, 
    onDuplicate,
    sourceName
  }: { 
    isOpen: boolean, 
    onClose: () => void, 
    onDuplicate: (count: number) => void,
    sourceName: string
  }) => {
    const [count, setCount] = useState(1);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Duplicate Test Data Sample
          </h3>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            How many copies of "{sourceName}" would you like to create?
          </p>
          
          <div className="mb-4">
            <label htmlFor="dup-count" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Number of Copies
            </label>
            <input
              type="number"
              id="dup-count"
              min={1}
              max={10}
              value={count}
              onChange={e => setCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500">
              Maximum 10 copies can be created at once
            </p>
          </div>
          
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                onDuplicate(count);
                onClose();
              }}
            >
              Create Copies
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Add back the GenerateMultipleDialog component
  const GenerateMultipleDialog = ({ 
    endpointKey, 
    isOpen, 
    onClose, 
    onGenerate 
  }: { 
    endpointKey: string, 
    isOpen: boolean, 
    onClose: () => void, 
    onGenerate: (count: number) => void 
  }) => {
    const [count, setCount] = useState(3);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Generate Multiple Samples
          </h3>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            How many test data samples would you like to generate for this endpoint?
          </p>
          
          <div className="mb-4">
            <label htmlFor="sample-count" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Number of Samples
            </label>
            <input
              type="number"
              id="sample-count"
              min={1}
              max={10}
              value={count}
              onChange={e => setCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500">
              Maximum 10 samples can be generated at once
            </p>
          </div>
          
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                onGenerate(count);
                onClose();
              }}
            >
              Generate
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 min-h-[0.8vh]">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              Configure test data for your API endpoints. The system will automatically generate realistic test values 
              for path parameters, query parameters, headers, and request bodies.
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Endpoint List - Left Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">API Endpoints</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[calc(100vh-300px)] overflow-y-auto">
            {selectedEndpoints.map(endpoint => {
              const hasData = !!testDataConfigs[endpoint]?.datasets?.length;
              const [method, path] = endpoint.split(' ');
              
              // Highlight if endpoint has path parameters or needs request body
              const needsData = hasPathParams(endpoint) || hasRequestBody(endpoint);
              
              return (
                <div 
                  key={endpoint}
                  className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                    activeEndpoint === endpoint ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => setActiveEndpoint(endpoint)}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        method === 'GET' ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' :
                        method === 'POST' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' :
                        method === 'PUT' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
                        method === 'DELETE' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                      }`}>
                        {method}
                      </span>
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate">
                        {path}
                        {needsData && 
                          <span className="text-xs font-normal ml-1 text-amber-600">
                            {hasPathParams(endpoint) ? '(has path params)' : ''}
                          </span>
                        }
                      </div>
                      <div className="mt-1 flex items-center text-xs">
                        {hasData ? (
                          <span className="text-green-600 dark:text-green-400 flex items-center">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {testDataConfigs[endpoint]?.datasets?.length} {testDataConfigs[endpoint]?.datasets?.length === 1 ? 'test data sample' : 'test data samples'}
                          </span>
                        ) : (
                          <span className="text-yellow-600 dark:text-yellow-400">No test data configured</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Test Data Display - Right Panel */}
        <div className="md:col-span-2">
          {!activeEndpoint ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6 text-center">
              <Info className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <h3 className="text-gray-800 dark:text-gray-200 font-medium mb-1">Select an Endpoint</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Choose an endpoint from the list to view and configure its test data
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Test Data for {activeEndpoint}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {hasPathParams(activeEndpoint) ? 'Includes values for path parameters.' : ''}
                    {hasRequestBody(activeEndpoint) ? ' Includes request body data.' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {/* Replace the three separate buttons with a dropdown */}
                  <div className="relative group inline-block">
                    <Button
                      size="sm"
                      variant="primary"
                      className="flex items-center justify-center"
                      onClick={() => handleGenerateData(activeEndpoint)}
                      disabled={!!generatingData[activeEndpoint]}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${generatingData[activeEndpoint] ? 'animate-spin' : ''}`} />
                      {generatingData[activeEndpoint] ? 'Generating...' : 'Generate Data'}
                      <svg className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </Button>

                    {/* Dropdown menu */}
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10 hidden group-hover:block">
                      <div className="py-1">
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                          onClick={() => handleGenerateData(activeEndpoint)}
                          disabled={!!generatingData[activeEndpoint]}
                        >
                          <RefreshCw className="h-3 w-3 mr-2 text-blue-500" />
                          Generate Single Sample
                          <span className="ml-2 text-xs text-gray-500">
                            (API schema)
                          </span>
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                          onClick={() => setShowMultipleDialog(true)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Generate Multiple Samples
                          <span className="ml-2 text-xs text-gray-500">
                            (2-10)
                          </span>
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                          onClick={() => handleAddDataset(activeEndpoint)}
                        >
                          <Plus className="h-3 w-3 mr-2 text-green-500" />
                          Add Empty Sample
                          <span className="ml-2 text-xs text-gray-500">
                            (Manual)
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Test Data Cards */}
              <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                {currentConfig?.datasets?.length ? (
                  <div className="space-y-4">
                    {currentConfig.datasets.map(dataset => (
                      <div 
                        key={dataset.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
                      >
                        {/* Card Header */}
                        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center rounded-t-lg">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {dataset.name}
                            {dataset.frequency && dataset.frequency > 1 && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 px-2 py-0.5 rounded-full">
                                {dataset.frequency}× frequency
                              </span>
                            )}
                          </h4>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center text-sm px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                              onClick={() => {
                                // Store the dataset ID for duplication dialog
                                setDuplicatingDataset(dataset.id);
                                // Set source name for dialog
                                setDuplicateSourceName(dataset.name);
                              }}
                              title="Create copies of this test data sample"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                                <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                              </svg>
                              Duplicate
                            </button>
                            <button
                              type="button"
                              className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                              onClick={() => setEditingDataset(dataset)}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                              onClick={() => handleDeleteDataset(activeEndpoint, dataset.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Card Content */}
                        <div className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Only show sections that have content */}
                            
                            {/* Path Parameters Section */}
                            {Object.keys(dataset.data.path_params || {}).length > 0 && (
                              <div className="border border-gray-100 dark:border-gray-700 rounded p-3 bg-gray-50 dark:bg-gray-800/50">
                                <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase flex items-center">
                                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                                  Path Parameters
                                </h5>
                                <div className="space-y-1.5">
                                  {Object.entries(dataset.data.path_params).map(([key, value]) => (
                                    <div key={key} className="flex items-start">
                                      <span className="text-xs font-mono text-green-600 dark:text-green-400 min-w-[80px] mr-2">{key}:</span>
                                      <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Query Parameters Section */}
                            {Object.keys(dataset.data.query_params || {}).length > 0 && (
                              <div className="border border-gray-100 dark:border-gray-700 rounded p-3 bg-gray-50 dark:bg-gray-800/50">
                                <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase flex items-center">
                                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1.5"></span>
                                  Query Parameters
                                </h5>
                                <div className="space-y-1.5">
                                  {Object.entries(dataset.data.query_params).map(([key, value]) => (
                                    <div key={key} className="flex items-start">
                                      <span className="text-xs font-mono text-yellow-600 dark:text-yellow-400 min-w-[80px] mr-2">{key}:</span>
                                      <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Headers Section */}
                            {Object.keys(dataset.data.headers || {}).length > 0 && (
                              <div className="border border-gray-100 dark:border-gray-700 rounded p-3 bg-gray-50 dark:bg-gray-800/50">
                                <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase flex items-center">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-1.5"></span>
                                  Headers
                                </h5>
                                <div className="space-y-1.5">
                                  {Object.entries(dataset.data.headers).map(([key, value]) => (
                                    <div key={key} className="flex items-start">
                                      <span className="text-xs font-mono text-blue-600 dark:text-blue-400 min-w-[80px] mr-2">{key}:</span>
                                      <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Request Body Section (Full Width) */}
                          {dataset.data.request_body && Object.keys(dataset.data.request_body).length > 0 && (
                            <div className="mt-4 border border-gray-100 dark:border-gray-700 rounded p-3 bg-gray-50 dark:bg-gray-800/50">
                              <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase flex items-center">
                                <span className="w-2 h-2 bg-purple-500 rounded-full mr-1.5"></span>
                                Request Body
                              </h5>
                              <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto p-2 bg-white dark:bg-gray-850 rounded border border-gray-200 dark:border-gray-700">
                                {formatDataForDisplay(dataset.data.request_body)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <Repeat className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-gray-800 dark:text-gray-200 font-medium mb-2">No Test Data Available</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto mb-6">
                      This endpoint needs test data before it can be used in the stress test. 
                      Generate data automatically or add a sample manually.
                    </p>
                    <Button
                      onClick={() => handleGenerateData(activeEndpoint)}
                      disabled={!!generatingData[activeEndpoint]}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${generatingData[activeEndpoint] ? 'animate-spin' : ''}`} />
                      Generate Test Data
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dataset editing modal */}
      {editingDataset && activeEndpoint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Edit Test Data Sample
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                onClick={() => setEditingDataset(null)}
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label htmlFor="dataset-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sample Name
                </label>
                <input
                  type="text"
                  id="dataset-name"
                  value={editingDataset.name}
                  onChange={e => setEditingDataset({
                    ...editingDataset,
                    name: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  API Request Data
                </div>
                <div className="space-y-4">
                  {/* Path Parameters */}
                  <div>
                    <label className="flex items-center text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                      Path Parameters: <span className="text-gray-400 ml-1">(values for {'{parameter}'} placeholders in URL)</span>
                    </label>
                    <textarea
                      value={formatDataForDisplay(editingDataset.data.path_params || {})}
                      onChange={e => {
                        try {
                          const path_params = JSON.parse(e.target.value);
                          setEditingDataset({
                            ...editingDataset,
                            data: {
                              ...editingDataset.data,
                              path_params
                            }
                          });
                        } catch (err) {
                          // Handle invalid JSON
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono h-20 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  
                  {/* Query Parameters */}
                  <div>
                    <label className="flex items-center text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1.5"></span>
                      Query Parameters: <span className="text-gray-400 ml-1">(parameters added to URL after ?)</span>
                    </label>
                    <textarea
                      value={formatDataForDisplay(editingDataset.data.query_params || {})}
                      onChange={e => {
                        try {
                          const query_params = JSON.parse(e.target.value);
                          setEditingDataset({
                            ...editingDataset,
                            data: {
                              ...editingDataset.data,
                              query_params
                            }
                          });
                        } catch (err) {
                          // Handle invalid JSON
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono h-20 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  
                  {/* Headers */}
                  <div>
                    <label className="flex items-center text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-1.5"></span>
                      Headers:
                    </label>
                    <textarea
                      value={formatDataForDisplay(editingDataset.data.headers || {})}
                      onChange={e => {
                        try {
                          const headers = JSON.parse(e.target.value);
                          setEditingDataset({
                            ...editingDataset,
                            data: {
                              ...editingDataset.data,
                              headers
                            }
                          });
                        } catch (err) {
                          // Handle invalid JSON
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono h-20 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  
                  {/* Request Body */}
                  <div>
                    <label className="flex items-center text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      <span className="w-2 h-2 bg-purple-500 rounded-full mr-1.5"></span>
                      Request Body: <span className="text-gray-400 ml-1">(JSON data sent with POST/PUT/PATCH requests)</span>
                    </label>
                    <textarea
                      value={formatDataForDisplay(editingDataset.data.request_body || {})}
                      onChange={e => {
                        try {
                          const request_body = JSON.parse(e.target.value);
                          setEditingDataset({
                            ...editingDataset,
                            data: {
                              ...editingDataset.data,
                              request_body
                            }
                          });
                        } catch (err) {
                          // Handle invalid JSON
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono h-32 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor="dataset-frequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sample Frequency
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    id="dataset-frequency"
                    min={1}
                    max={100}
                    value={editingDataset.frequency || 1}
                    onChange={e => setEditingDataset({
                      ...editingDataset,
                      frequency: Math.max(1, parseInt(e.target.value) || 1)
                    })}
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                  />
                  <span className="ml-2 text-sm text-gray-500">
                    (Higher values will use this sample more frequently during testing)
                  </span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3 sticky bottom-0 bg-white dark:bg-gray-800 z-10">
              <Button
                variant="outline"
                onClick={() => setEditingDataset(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSaveDataset(activeEndpoint, editingDataset)}
              >
                Save Test Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {showMultipleDialog && activeEndpoint && (
        <GenerateMultipleDialog
          endpointKey={activeEndpoint}
          isOpen={showMultipleDialog}
          onClose={() => setShowMultipleDialog(false)}
          onGenerate={(count) => generateMultipleSamples(activeEndpoint, count)}
        />
      )}

      {duplicatingDataset && activeEndpoint && (
        <DuplicateDialog
          isOpen={!!duplicatingDataset}
          onClose={() => setDuplicatingDataset(null)}
          onDuplicate={(count) => {
            replicateSample(activeEndpoint, duplicatingDataset, count);
            setDuplicatingDataset(null);
          }}
          sourceName={duplicateSourceName}
        />
      )}
    </div>
  );
}

// Add validation to the component
TestDataStep.validate = () => {
  const { selectedEndpoints, endpointConfigs } = useWizard();
  // @ts-ignore - Type mismatch between StressTestEndpointConfig and TestDataConfig
  return validateTestData(selectedEndpoints, endpointConfigs);
}; 