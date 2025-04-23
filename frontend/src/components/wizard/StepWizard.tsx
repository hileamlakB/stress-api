import React, { useState, ReactNode } from 'react';
import { Button } from '../Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type Step = {
  id: string;
  title: string;
  component: ReactNode;
  optional?: boolean;
};

type StepWizardProps = {
  steps: Step[];
  onComplete: () => void;
  initialStep?: number;
};

export function StepWizard({ steps, onComplete, initialStep = 0 }: StepWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStep);
  
  const goToNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      onComplete();
    }
  };
  
  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };
  
  const goToStep = (index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
    }
  };
  
  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  
  return (
    <div className="flex flex-col h-full">
      {/* Progress Stepper */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              {/* Step Circle */}
              <div 
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 cursor-pointer ${
                  index < currentStepIndex 
                    ? 'bg-blue-500 border-blue-500 text-white' 
                    : index === currentStepIndex 
                      ? 'border-blue-500 text-blue-500' 
                      : 'border-gray-300 text-gray-400'
                }`}
                onClick={() => index <= currentStepIndex && goToStep(index)}
              >
                {index < currentStepIndex ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <span className="text-sm">{index + 1}</span>
                )}
              </div>
              
              {/* Connector Line (except after last step) */}
              {index < steps.length - 1 && (
                <div 
                  className={`flex-1 h-0.5 mx-4 ${
                    index < currentStepIndex ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        
        {/* Step Titles */}
        <div className="flex items-center justify-between mt-2">
          {steps.map((step, index) => (
            <div 
              key={`title-${step.id}`}
              className={`text-xs font-medium ${
                index <= currentStepIndex ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
              }`}
              style={{ 
                width: `${100 / steps.length}%`,
                textAlign: index === 0 ? 'left' : index === steps.length - 1 ? 'right' : 'center'
              }}
            >
              {step.title}
              {step.optional && <span className="text-gray-400 ml-1">(Optional)</span>}
            </div>
          ))}
        </div>
      </div>
      
      {/* Current Step Content */}
      <div className="flex-1 mb-6">
        {currentStep.component}
      </div>
      
      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button 
          variant="outline"
          onClick={goToPreviousStep}
          disabled={isFirstStep}
          className="flex items-center"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        
        <Button 
          onClick={goToNextStep}
          className="flex items-center"
        >
          {isLastStep ? 'Start Test' : 'Next'}
          {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
} 