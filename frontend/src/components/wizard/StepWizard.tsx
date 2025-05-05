import React, { useState, ReactElement, useEffect, cloneElement } from 'react';
import { Button } from '../Button';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { useWizard } from './WizardContext';
import apiService from '../../services/ApiService';

// Define a validation function type
export type ValidationResult = { valid: boolean; message?: string } | boolean;
export type ValidateFunction = () => ValidationResult;

// Update the component interface to include a validate function
interface ComponentWithValidation extends React.FC {
  validate?: ValidateFunction;
}

export type Step = {
  id: string;
  title: string;
  component: ReactElement;
  optional?: boolean;
};

type StepWizardProps = {
  steps: Step[];
  onComplete: () => void;
  initialStep?: number;
};

export function StepWizard({ steps, onComplete, initialStep = 0 }: StepWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStep);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validatedSteps, setValidatedSteps] = useState<Record<string, boolean>>({});
  const [isCurrentStepValid, setIsCurrentStepValid] = useState<boolean>(false);
  const [savingSession, setSavingSession] = useState(false);
  
  // Get wizard context to access form data
  const wizardContext = useWizard();
  
  // Function to validate the current step
  const validateCurrentStep = () => {
    const currentStep = steps[currentStepIndex];
    
    // If the step is optional, it's always valid
    if (currentStep.optional) {
      setIsCurrentStepValid(true);
      return true;
    }

    // Default to invalid until proven valid
    let isValid = false;
    
    try {
      // Get the component and try to access its validation function
      const childElement = currentStep.component;
      const childType = childElement.type as ComponentWithValidation;
      
      // If no validation function, assume it's valid
      if (!childType.validate) {
        setIsCurrentStepValid(true);
        setValidationError(null);
        return true;
      }
      
      // Call the validate function
      const result = childType.validate();
      
      if (typeof result === 'boolean') {
        isValid = result;
        
        if (!result) {
          setValidationError('Please complete all required fields in this step before continuing.');
        } else {
          setValidationError(null);
          // Mark as validated
          setValidatedSteps(prev => ({
            ...prev,
            [currentStep.id]: true
          }));
        }
      } else {
        isValid = result.valid;
        
        if (!result.valid) {
          setValidationError(result.message || 'Please complete all required fields.');
        } else {
          setValidationError(null);
          // Mark as validated
          setValidatedSteps(prev => ({
            ...prev,
            [currentStep.id]: true
          }));
        }
      }
      
      // Update state with validation result
      setIsCurrentStepValid(isValid);
      return isValid;
    } catch (error) {
      console.error("Validation error:", error);
      setIsCurrentStepValid(false);
      setValidationError("Error validating step. Please check console.");
      return false;
    }
  };
  
  // Check validation whenever context data changes
  useEffect(() => {
    console.log("VALIDATION STATUS:", {
      stepId: steps[currentStepIndex].id,
      isStepValid: isCurrentStepValid,
      isOptional: steps[currentStepIndex].optional,
      isButtonDisabled: !isCurrentStepValid && !steps[currentStepIndex].optional
    });

    const timer = setTimeout(() => {
      validateCurrentStep();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [
    wizardContext.baseUrl, 
    wizardContext.authConfig,
    JSON.stringify(wizardContext.authConfig),
    wizardContext.selectedEndpoints,
    wizardContext.concurrentRequests,
    currentStepIndex,
    isCurrentStepValid
  ]);

  // Force validation on initial render and step change
  useEffect(() => {
    // Run validation immediately when step changes
    validateCurrentStep();
    
    // Also run validation again after a slight delay to make sure all component state is settled
    const timer = setTimeout(() => {
      validateCurrentStep();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [currentStepIndex]);
  
  // Save the current wizard state to the session
  const saveWizardState = async () => {
    // Check if we have a test ID to save to
    if (!wizardContext.activeTestId) return;
    
    try {
      setSavingSession(true);
      
      // Prepare the test configuration data
      const testConfig = {
        target_url: wizardContext.baseUrl,
        concurrent_users: wizardContext.concurrentRequests,
        endpoints: wizardContext.selectedEndpoints,
        strategy: wizardContext.distributionMode,
        strategy_options: wizardContext.strategyOptions,
        // Add auth configuration
        auth: {
          method: wizardContext.authConfig.method,
          config: wizardContext.authConfig
        },
        // Add additional state
        ui_state: {
          currentStep: currentStepIndex,
          activeEndpointTab: wizardContext.activeEndpointTab,
          endpointMethodFilter: wizardContext.endpointMethodFilter,
          showAdvancedOptions: wizardContext.showAdvancedOptions
        }
      };
      
      // Create session configuration in the database
      await apiService.updateSessionState(
        wizardContext.activeTestId,
        {
          success_criteria: testConfig, // Store our state in success_criteria for now
          endpoint_url: wizardContext.baseUrl,
          http_method: "GET", // Default
          concurrent_users: wizardContext.concurrentRequests,
          ramp_up_time: 5, // Default
          test_duration: 60, // Default
          think_time: 1 // Default
        }
      );
      
      console.log("Wizard state saved to session");
    } catch (error) {
      console.error("Error saving wizard state:", error);
    } finally {
      setSavingSession(false);
    }
  };
  
  // Helper: call onStepNext if the step supports it
  const callStepOnNext = async () => {
    const currentStep = steps[currentStepIndex];
    const childElement = currentStep.component;
    // If the component has an onStepNext prop, call it
    if (childElement.props && typeof childElement.props.onStepNext === 'function') {
      await childElement.props.onStepNext();
    }
  };

  const goToNextStep = async () => {
    const isValid = validateCurrentStep();
    if (!isValid && !steps[currentStepIndex].optional) {
      return;
    }
    // Call the step's onStepNext before saving state and moving on
    await callStepOnNext();
    // Save the current state before moving to the next step
    await saveWizardState();
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setValidationError(null);
    } else {
      onComplete();
    }
  };
  
  const goToPreviousStep = async () => {
    // Save the current state before moving to the previous step
    await saveWizardState();
    
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      setValidationError(null);
    }
  };
  
  const goToStep = async (index: number) => {
    if (
      index >= 0 && 
      index < steps.length && 
      (index <= currentStepIndex || validatedSteps[steps[index-1]?.id])
    ) {
      // Save current state before changing steps
      await saveWizardState();
      
      setCurrentStepIndex(index);
      setValidationError(null);
    }
  };
  
  // Render the current step, injecting onStepNext if supported
  const currentStep = steps[currentStepIndex];
  let stepComponent = currentStep.component;
  if (stepComponent.props && 'onStepNext' in stepComponent.props) {
    stepComponent = cloneElement(stepComponent, {
      onStepNext: () => {
        // For EndpointSelectionStep, sync local selection to context
        if (typeof stepComponent.props.syncSelectionToContext === 'function') {
          stepComponent.props.syncSelectionToContext();
        }
      }
    });
  }
  
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  
  return (
    <div className="flex flex-col h-full">
      {/* Progress Stepper */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isStepCompleted = index < currentStepIndex;
            const isCurrentStep = index === currentStepIndex;
            const isPreviousStepCompleted = validatedSteps[steps[index-1]?.id] || index <= currentStepIndex;
            const isClickable = index <= currentStepIndex || (isPreviousStepCompleted && validatedSteps[steps[currentStepIndex]?.id]);
            
            return (
              <React.Fragment key={step.id}>
                {/* Step Circle */}
                <div 
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                  } ${
                    isStepCompleted 
                      ? 'bg-blue-500 border-blue-500 text-white' 
                      : isCurrentStep 
                        ? 'border-blue-500 text-blue-500' 
                        : 'border-gray-300 text-gray-400'
                  }`}
                  onClick={() => isClickable && goToStep(index)}
                >
                  {isStepCompleted ? (
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
            );
          })}
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
      
      {/* Validation Error */}
      {validationError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{validationError}</p>
        </div>
      )}
      
      {/* Current Step Content */}
      <div className="flex-1 mb-6">
        {stepComponent}
      </div>
      
      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button 
          variant="outline"
          onClick={goToPreviousStep}
          disabled={isFirstStep || savingSession}
          className="flex items-center"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {savingSession ? 'Saving...' : 'Back'}
        </Button>
        
        {/* Next/Complete button with highlighted disabled state */}
        <Button 
          onClick={goToNextStep}
          disabled={(!isCurrentStepValid && !currentStep.optional) || savingSession}
          className={`flex items-center ${!isCurrentStepValid && !currentStep.optional 
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300 hover:bg-gray-300 hover:text-gray-500 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-700' 
            : ''}`}
        >
          {isLastStep ? 'Start Test' : (savingSession ? 'Saving...' : 'Next')}
          {!isLastStep && !savingSession && <ChevronRight className="h-4 w-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
} 