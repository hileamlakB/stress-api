import React, { createContext, useContext, useState } from 'react';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tab components must be used within a Tabs component');
  }
  return context;
}

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  className = '',
  children
}: TabsProps) {
  const [tabValue, setTabValue] = useState(defaultValue);
  
  const currentValue = value !== undefined ? value : tabValue;
  const changeValue = onValueChange || setTabValue;
  
  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: changeValue }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

export function TabsList({ className = '', children }: TabsListProps) {
  return (
    <div className={`flex space-x-1 overflow-x-auto ${className}`}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function TabsTrigger({
  value,
  className = '',
  children,
  disabled = false
}: TabsTriggerProps) {
  const { value: selectedValue, onValueChange } = useTabsContext();
  const isSelected = selectedValue === value;
  
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      aria-controls={`content-${value}`}
      disabled={disabled}
      className={`px-3 py-2 rounded-t-md text-sm font-medium transition-colors 
        ${isSelected 
          ? 'bg-white border-b-2 border-blue-500 text-blue-600' 
          : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}`
      }
      onClick={() => onValueChange(value)}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export function TabsContent({
  value,
  className = '',
  children
}: TabsContentProps) {
  const { value: selectedValue } = useTabsContext();
  const isSelected = selectedValue === value;
  
  if (!isSelected) return null;
  
  return (
    <div
      role="tabpanel"
      id={`content-${value}`}
      aria-labelledby={`trigger-${value}`}
      className={className}
    >
      {children}
    </div>
  );
} 