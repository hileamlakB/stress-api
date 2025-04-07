import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wand2, LayoutDashboard } from 'lucide-react';
import { EndpointsList } from './endpoints/EndpointsList';
import { EndpointSchema, StressTestEndpointConfig } from '../types/api';
import { Button } from './Button';

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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Test: Endpoint Data Configuration</h2>
        <div className="flex space-x-3">
          <Link to="/dashboard">
            <Button size="sm" className="flex items-center">
              <LayoutDashboard className="h-4 w-4 mr-1" />
              Dashboard
            </Button>
          </Link>
          <Link to="/wizard">
            <Button size="sm" className="flex items-center">
              <Wand2 className="h-4 w-4 mr-1" />
              Wizard
            </Button>
          </Link>
        </div>
      </div>
      
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