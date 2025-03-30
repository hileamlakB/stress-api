import React from 'react';

interface JsonViewProps {
  data: any;
  className?: string;
}

export function JsonView({ data, className = '' }: JsonViewProps) {
  const formattedJson = JSON.stringify(data, null, 2);
  
  return (
    <pre className={`text-xs font-mono overflow-auto max-h-96 ${className}`}>
      {formattedJson}
    </pre>
  );
} 