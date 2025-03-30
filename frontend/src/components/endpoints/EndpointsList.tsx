import React, { useState } from 'react';
import { EndpointSchema, DataGenerationStrategy, EndpointTestDataSample, StressTestEndpointConfig } from '../../types/api';
import { EndpointDataConfig } from './EndpointDataConfig';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

interface EndpointsListProps {
  selectedEndpoints: string[];
  endpointsData: EndpointSchema[];
  onEndpointConfigChange: (endpointConfigs: Record<string, StressTestEndpointConfig>) => void;
}

export function EndpointsList({
  selectedEndpoints,
  endpointsData,
  onEndpointConfigChange
}: EndpointsListProps) {
  // Store configurations for each endpoint
  const [endpointConfigs, setEndpointConfigs] = useState<Record<string, StressTestEndpointConfig>>({});
  // Track which accordions are expanded
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  
  // Find the endpoint schema for a given endpoint key
  const getEndpointSchema = (endpointKey: string): EndpointSchema | undefined => {
    const [method, path] = endpointKey.split(' ', 2);
    return endpointsData.find(e => e.method === method && e.path === path);
  };
  
  // Handle data strategy change for an endpoint
  const handleDataStrategyChange = (endpointKey: string, strategy: DataGenerationStrategy) => {
    setEndpointConfigs(prev => {
      const updated = {
        ...prev,
        [endpointKey]: {
          ...prev[endpointKey] || { path: endpointKey.split(' ')[1], method: endpointKey.split(' ')[0] },
          data_strategy: strategy
        }
      };
      onEndpointConfigChange(updated);
      return updated;
    });
  };
  
  // Handle data samples change for an endpoint
  const handleDataSamplesChange = (endpointKey: string, samples: EndpointTestDataSample[]) => {
    setEndpointConfigs(prev => {
      const updated = {
        ...prev,
        [endpointKey]: {
          ...prev[endpointKey] || { path: endpointKey.split(' ')[1], method: endpointKey.split(' ')[0] },
          test_data_samples: samples
        }
      };
      onEndpointConfigChange(updated);
      return updated;
    });
  };
  
  // Toggle accordion expansion
  const toggleAccordion = (endpointKey: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [endpointKey]: !prev[endpointKey]
    }));
  };
  
  if (selectedEndpoints.length === 0) {
    return (
      <Card className="mt-6">
        <CardContent className="p-6 text-center text-gray-500">
          No endpoints selected. Please select endpoints to configure test data.
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Configure Test Data for Selected Endpoints</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {selectedEndpoints.map(endpointKey => {
            const endpointSchema = getEndpointSchema(endpointKey);
            if (!endpointSchema) return null;
            
            return (
              <AccordionItem
                key={endpointKey}
                value={endpointKey}
                expanded={expandedItems[endpointKey]}
                onExpandedChange={() => toggleAccordion(endpointKey)}
              >
                <AccordionTrigger className="px-4 py-2 hover:bg-gray-50">
                  <div className="flex items-center space-x-2">
                    <span className={`font-mono px-2 py-1 text-xs rounded ${
                      endpointSchema.method === 'GET' ? 'bg-green-100 text-green-800' :
                      endpointSchema.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                      endpointSchema.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                      endpointSchema.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {endpointSchema.method}
                    </span>
                    <span className="font-mono text-sm">{endpointSchema.path}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pt-2 pb-4">
                  <EndpointDataConfig
                    endpoint={endpointSchema}
                    onDataStrategyChange={(strategy) => handleDataStrategyChange(endpointKey, strategy)}
                    onDataSamplesChange={(samples) => handleDataSamplesChange(endpointKey, samples)}
                  />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
} 