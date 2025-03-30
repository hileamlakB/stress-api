import React, { useState } from 'react';
import { EndpointsList } from './endpoints/EndpointsList';
import { EndpointSchema, StressTestEndpointConfig } from '../types/api';

// Sample endpoint data for testing
const sampleEndpoints: EndpointSchema[] = [
  {
    method: 'GET',
    path: '/api/users',
    summary: 'Get all users',
    description: 'Retrieve a list of all users',
    parameters: [],
    responses: {
      '200': {
        status_code: '200',
        content_type: 'application/json',
        response_schema: { type: 'array' },
        description: 'List of users'
      }
    }
  },
  {
    method: 'POST',
    path: '/api/users',
    summary: 'Create user',
    description: 'Create a new user',
    parameters: [],
    request_body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' }
      }
    },
    responses: {
      '201': {
        status_code: '201',
        content_type: 'application/json',
        response_schema: { type: 'object' },
        description: 'User created'
      }
    }
  }
];

interface EndpointDataWrapperProps {
  showTestComponent?: boolean;
}

export function EndpointDataWrapper({ showTestComponent = true }: EndpointDataWrapperProps) {
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([
    'GET /api/users',
    'POST /api/users'
  ]);
  const [endpointConfigs, setEndpointConfigs] = useState<Record<string, StressTestEndpointConfig>>({});
  
  const handleEndpointConfigChange = (configs: Record<string, StressTestEndpointConfig>) => {
    setEndpointConfigs(configs);
    console.log('Endpoint configurations updated:', configs);
  };
  
  if (!showTestComponent) {
    return null;
  }
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Test: Endpoint Data Configuration</h2>
      
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <h3 className="font-medium mb-2">Selected Endpoints:</h3>
        <ul className="list-disc pl-5">
          {selectedEndpoints.map(endpoint => (
            <li key={endpoint}>{endpoint}</li>
          ))}
        </ul>
      </div>
      
      <EndpointsList
        selectedEndpoints={selectedEndpoints}
        endpointsData={sampleEndpoints}
        onEndpointConfigChange={handleEndpointConfigChange}
      />
      
      <div className="mt-6 p-4 bg-gray-100 rounded">
        <h3 className="font-medium mb-2">Current Configuration:</h3>
        <pre className="text-xs overflow-auto p-2 bg-white border rounded">
          {JSON.stringify(endpointConfigs, null, 2)}
        </pre>
      </div>
    </div>
  );
} 