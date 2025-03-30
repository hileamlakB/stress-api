import React, { createContext, useContext, useState } from 'react';
import { ChevronDown } from 'lucide-react';

type AccordionType = 'single' | 'multiple';

interface AccordionContextType {
  type: AccordionType;
  expandedItems: Record<string, boolean>;
  toggleItem: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextType | undefined>(undefined);

function useAccordionContext() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion components must be used within an Accordion component');
  }
  return context;
}

interface AccordionProps {
  type?: AccordionType;
  className?: string;
  children: React.ReactNode;
  defaultValue?: string | string[];
}

export function Accordion({
  type = 'single',
  className = '',
  children,
  defaultValue
}: AccordionProps) {
  // Initialize expanded items based on defaultValue
  const initialExpanded: Record<string, boolean> = {};
  
  if (defaultValue) {
    if (Array.isArray(defaultValue)) {
      defaultValue.forEach(value => {
        initialExpanded[value] = true;
      });
    } else {
      initialExpanded[defaultValue] = true;
    }
  }
  
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(initialExpanded);
  
  const toggleItem = (value: string) => {
    if (type === 'single') {
      // Close all others
      const newExpandedItems: Record<string, boolean> = {};
      newExpandedItems[value] = !expandedItems[value];
      setExpandedItems(newExpandedItems);
    } else {
      // Toggle current, leave others unchanged
      setExpandedItems({
        ...expandedItems,
        [value]: !expandedItems[value]
      });
    }
  };
  
  return (
    <AccordionContext.Provider value={{ type, expandedItems, toggleItem }}>
      <div className={`divide-y divide-gray-200 ${className}`}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  value: string;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
  children: React.ReactNode;
}

export function AccordionItem({
  value,
  expanded,
  onExpandedChange,
  className = '',
  children
}: AccordionItemProps) {
  const context = useAccordionContext();
  const isControlled = expanded !== undefined;
  const isExpanded = isControlled ? expanded : context.expandedItems[value];
  
  const handleToggle = () => {
    if (isControlled && onExpandedChange) {
      onExpandedChange(!isExpanded);
    } else {
      context.toggleItem(value);
    }
  };
  
  return (
    <div className={`border-gray-200 ${className}`} data-state={isExpanded ? 'open' : 'closed'}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            isExpanded,
            handleToggle
          });
        }
        return child;
      })}
    </div>
  );
}

interface AccordionTriggerProps {
  className?: string;
  children: React.ReactNode;
  isExpanded?: boolean;
  handleToggle?: () => void;
}

export function AccordionTrigger({
  className = '',
  children,
  isExpanded,
  handleToggle
}: AccordionTriggerProps) {
  return (
    <button
      type="button"
      className={`flex justify-between w-full py-4 text-left text-sm font-medium ${className}`}
      onClick={handleToggle}
      aria-expanded={isExpanded}
    >
      {children}
      <ChevronDown 
        className={`h-5 w-5 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`} 
      />
    </button>
  );
}

interface AccordionContentProps {
  className?: string;
  children: React.ReactNode;
  isExpanded?: boolean;
}

export function AccordionContent({
  className = '',
  children,
  isExpanded
}: AccordionContentProps) {
  if (!isExpanded) return null;
  
  return (
    <div className={className}>
      {children}
    </div>
  );
} 