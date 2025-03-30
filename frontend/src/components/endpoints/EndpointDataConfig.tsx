import { useState, useEffect } from 'react';
import { Select } from '../ui/select';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { EndpointSchema, DataGenerationStrategy, EndpointTestDataSample } from '../../types/api';
import apiService from '../../services/ApiService';
import { Loader2, Plus, Trash } from 'lucide-react';
import { JsonView } from '../ui/json-view';

interface EndpointDataConfigProps {
  endpoint: EndpointSchema;
  onDataStrategyChange: (strategy: DataGenerationStrategy) => void;
  onDataSamplesChange: (samples: EndpointTestDataSample[]) => void;
}

export function EndpointDataConfig({
  endpoint,
  onDataStrategyChange,
  onDataSamplesChange
}: EndpointDataConfigProps) {
  const [loading, setLoading] = useState(false);
  const [dataStrategy, setDataStrategy] = useState<DataGenerationStrategy>('consistent_random');
  const [dataSamples, setDataSamples] = useState<EndpointTestDataSample[]>([]);
  const [activeTab, setActiveTab] = useState('sample-0');
  const [editMode, setEditMode] = useState(false); // Toggle between view/edit mode
  
  const endpointKey = `${endpoint.method} ${endpoint.path}`;
  
  // Initially generate one sample when the component mounts
  useEffect(() => {
    if (endpoint) {
      generateEndpointData(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);
  
  // Notify parent component when strategy or samples change
  useEffect(() => {
    onDataStrategyChange(dataStrategy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataStrategy]);
  
  useEffect(() => {
    onDataSamplesChange(dataSamples);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSamples]);
  
  const generateEndpointData = async (count: number) => {
    try {
      setLoading(true);
      
      try {
        // Try to call the actual API
        const result = await apiService.generateEndpointTestData(
          endpointKey,
          endpoint,
          count
        );
        
        // Set the generated data samples
        setDataSamples(result.data_samples);
        
      } catch (apiError) {
        console.error('API error, falling back to mock data:', apiError);
        
        // API failed, generate mock data instead
        const mockSamples = generateMockData(endpoint, count);
        setDataSamples(mockSamples);
      }
      
      // Set the first tab as active
      if (dataSamples.length > 0) {
        setActiveTab(`sample-0`);
      }
    } catch (error) {
      console.error('Error generating endpoint data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to generate mock data when API fails
  const generateMockData = (endpoint: EndpointSchema, count: number) => {
    const mockSamples = [];
    
    for (let i = 0; i < count; i++) {
      const sample: any = {};
      
      // Generate mock path parameters
      if (endpoint.parameters.some(p => p.location === 'path')) {
        const pathParams: Record<string, any> = {};
        endpoint.parameters
          .filter(p => p.location === 'path')
          .forEach(p => {
            // Generate some basic mock data based on parameter type
            const paramType = p.param_schema?.type || 'string';
            if (paramType === 'string') {
              pathParams[p.name] = `sample-${i+1}`;
            } else if (paramType === 'integer' || paramType === 'number') {
              pathParams[p.name] = i + 1;
            } else if (paramType === 'boolean') {
              pathParams[p.name] = i % 2 === 0;
            }
          });
        sample.path_parameters = pathParams;
      }
      
      // Generate mock query parameters
      if (endpoint.parameters.some(p => p.location === 'query')) {
        const queryParams: Record<string, any> = {};
        endpoint.parameters
          .filter(p => p.location === 'query')
          .forEach(p => {
            const paramType = p.param_schema?.type || 'string';
            if (paramType === 'string') {
              queryParams[p.name] = `value-${i+1}`;
            } else if (paramType === 'integer' || paramType === 'number') {
              queryParams[p.name] = (i + 1) * 10;
            } else if (paramType === 'boolean') {
              queryParams[p.name] = i % 2 === 0;
            }
          });
        sample.query_parameters = queryParams;
      }
      
      // Generate mock request body if needed
      if (endpoint.request_body) {
        sample.body = { 
          id: i + 1,
          name: `Sample ${i+1}`,
          created: new Date().toISOString()
        };
      }
      
      mockSamples.push(sample);
    }
    
    return mockSamples;
  };

  // Function to add a new empty sample
  const addEmptySample = () => {
    const newSample: EndpointTestDataSample = {};
    setDataSamples([...dataSamples, newSample]);
    setActiveTab(`sample-${dataSamples.length}`);
  };

  // Function to delete a sample
  const deleteSample = (index: number) => {
    if (dataSamples.length <= 1) {
      // Don't delete the last sample
      return;
    }
    
    const newSamples = [...dataSamples];
    newSamples.splice(index, 1);
    setDataSamples(newSamples);
    
    // Set active tab to the previous sample or the first one
    const newActiveIndex = Math.min(index, newSamples.length - 1);
    setActiveTab(`sample-${newActiveIndex}`);
  };
  
  // Function to update a specific part of a sample
  const updateSample = (sampleIndex: number, section: string, paramName: string, value: any) => {
    const newSamples = [...dataSamples];
    const sample = {...newSamples[sampleIndex]};
    
    // Initialize the section if it doesn't exist
    if (!sample[section]) {
      sample[section] = {};
    }
    
    // Update the parameter
    sample[section][paramName] = value;
    
    // Update the sample in the array
    newSamples[sampleIndex] = sample;
    setDataSamples(newSamples);
  };

  // Function to update the whole body
  const updateRequestBody = (sampleIndex: number, newBody: any) => {
    const newSamples = [...dataSamples];
    const sample = {...newSamples[sampleIndex]};
    
    sample.body = newBody;
    
    newSamples[sampleIndex] = sample;
    setDataSamples(newSamples);
  };
  
  const handleStrategyChange = (value: string) => {
    setDataStrategy(value as DataGenerationStrategy);
  };

  // Converts a schema type and format to render appropriate input control
  const renderInputForType = (
    type: string, 
    value: any, 
    onChange: (value: any) => void, 
    paramSchema?: any
  ) => {
    const format = paramSchema?.format || '';
    const enumValues = paramSchema?.enum || [];
    
    // If we have enum values, render a select
    if (enumValues.length > 0) {
      return (
        <Select
          value={String(value)}
          onValueChange={(newValue) => onChange(newValue)}
          options={enumValues.map(val => ({ label: String(val), value: String(val) }))}
        />
      );
    }
    
    // Otherwise render the appropriate input based on type and format
    switch (type) {
      case 'string':
        if (format === 'date-time' || format === 'date') {
          return (
            <input
              type="datetime-local"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-2 border rounded-md"
            />
          );
        } else if (format === 'email') {
          return (
            <input
              type="email"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-2 border rounded-md"
            />
          );
        } else if (format === 'uri') {
          return (
            <input
              type="url"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-2 border rounded-md"
            />
          );
        } else if (format === 'password') {
          return (
            <input
              type="password"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-2 border rounded-md"
            />
          );
        } else {
          return (
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-2 border rounded-md"
            />
          );
        }
      case 'integer':
      case 'number':
        return (
          <input
            type="number"
            value={value || 0}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full p-2 border rounded-md"
          />
        );
      case 'boolean':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="mr-2 w-4 h-4"
            />
            <span className="text-sm">{value ? 'True' : 'False'}</span>
          </div>
        );
      case 'object':
        return (
          <textarea
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch (error) {
                // Don't update on invalid JSON
              }
            }}
            className="w-full p-2 border rounded-md font-mono text-sm h-32"
          />
        );
      case 'array':
        return (
          <textarea
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch (error) {
                // Don't update on invalid JSON
              }
            }}
            className="w-full p-2 border rounded-md font-mono text-sm h-32"
          />
        );
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-2 border rounded-md"
          />
        );
    }
  };

  const renderFormForSample = (sample: EndpointTestDataSample, index: number) => {
    return (
      <div className="space-y-6">
        {/* Path Parameters */}
        {endpoint.parameters.some(p => p.location === 'path') && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Path Parameters</h3>
            <div className="space-y-4">
              {endpoint.parameters
                .filter(p => p.location === 'path')
                .map(param => (
                  <div key={param.name} className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                      {param.name} {param.required && <span className="text-red-500">*</span>}
                    </label>
                    <div className="text-xs text-gray-500 mb-1">
                      {param.description || `Type: ${param.param_schema?.type || 'string'}`}
                    </div>
                    {renderInputForType(
                      param.param_schema?.type || 'string',
                      sample.path_parameters?.[param.name] || '',
                      (value) => updateSample(index, 'path_parameters', param.name, value),
                      param.param_schema
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Query Parameters */}
        {endpoint.parameters.some(p => p.location === 'query') && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Query Parameters</h3>
            <div className="space-y-4">
              {endpoint.parameters
                .filter(p => p.location === 'query')
                .map(param => (
                  <div key={param.name} className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                      {param.name} {param.required && <span className="text-red-500">*</span>}
                    </label>
                    <div className="text-xs text-gray-500 mb-1">
                      {param.description || `Type: ${param.param_schema?.type || 'string'}`}
                    </div>
                    {renderInputForType(
                      param.param_schema?.type || 'string',
                      sample.query_parameters?.[param.name] || '',
                      (value) => updateSample(index, 'query_parameters', param.name, value),
                      param.param_schema
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Header Parameters */}
        {endpoint.parameters.some(p => p.location === 'header') && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Header Parameters</h3>
            <div className="space-y-4">
              {endpoint.parameters
                .filter(p => p.location === 'header')
                .map(param => (
                  <div key={param.name} className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                      {param.name} {param.required && <span className="text-red-500">*</span>}
                    </label>
                    <div className="text-xs text-gray-500 mb-1">
                      {param.description || `Type: ${param.param_schema?.type || 'string'}`}
                    </div>
                    {renderInputForType(
                      param.param_schema?.type || 'string',
                      sample.headers?.[param.name] || '',
                      (value) => updateSample(index, 'headers', param.name, value),
                      param.param_schema
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Request Body */}
        {endpoint.request_body && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Request Body</h3>
            <textarea
              value={JSON.stringify(sample.body || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateRequestBody(index, parsed);
                } catch (error) {
                  // Don't update on invalid JSON
                }
              }}
              className="w-full p-3 border rounded-md font-mono text-sm h-64"
            />
          </div>
        )}
      </div>
    );
  };
  
  return (
    <Card className="w-full mt-4">
      <CardHeader>
        <CardTitle className="text-md flex justify-between items-center">
          <span>Data Generation for {endpoint.method} {endpoint.path}</span>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Data Generation Strategy Selection */}
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm">
              Data Generation Strategy:
            </label>
            <Select
              value={dataStrategy}
              onValueChange={handleStrategyChange}
              options={[
                { label: 'Random for each test', value: 'random_each_time' },
                { label: 'Consistent random data', value: 'consistent_random' },
                { label: 'User-defined data', value: 'user_defined' }
              ]}
            />
            <p className="text-xs text-gray-500 mt-1">
              {dataStrategy === 'random_each_time' && 'New random data will be generated for each test request'}
              {dataStrategy === 'consistent_random' && 'The same random data will be used for all test requests'}
              {dataStrategy === 'user_defined' && 'Use your custom data for all test requests'}
            </p>
          </div>
          
          {/* View/Edit Toggle */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? 'View Mode' : 'Edit Mode'}
            </Button>
          </div>
          
          {/* Data Sample Controls */}
          <div className="flex justify-between items-center">
            <label className="font-medium text-sm">
              Data Samples ({dataSamples.length})
            </label>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={addEmptySample}
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Empty Sample
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateEndpointData(dataSamples.length + 1)}
                disabled={loading}
              >
                Add Sample
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateEndpointData(5)}
                disabled={loading}
              >
                Generate 5 Samples
              </Button>
            </div>
          </div>
          
          {/* Data Samples Tabs */}
          {dataSamples.length > 0 ? (
            <Tabs
              defaultValue="sample-0"
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="mb-2 overflow-x-auto">
                {dataSamples.map((_, index) => (
                  <TabsTrigger key={`tab-${index}`} value={`sample-${index}`}>
                    Sample {index + 1}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {dataSamples.map((sample, index) => (
                <TabsContent key={`content-${index}`} value={`sample-${index}`}>
                  <div className="flex justify-end mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteSample(index)}
                      disabled={dataSamples.length <= 1}
                      className="text-red-500"
                    >
                      <Trash className="h-4 w-4 mr-1" />
                      Delete Sample
                    </Button>
                  </div>
                  
                  {editMode ? (
                    renderFormForSample(sample, index)
                  ) : (
                    <div className="border rounded-md p-4 bg-gray-50">
                      <JsonView data={sample} />
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="text-center p-4 border rounded-md text-gray-500">
              No data samples generated yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 