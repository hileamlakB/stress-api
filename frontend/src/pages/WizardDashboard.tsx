import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, LogOut, PlusCircle, ArrowRight, LineChart } from 'lucide-react';
import { Button } from '../components/Button';
import { StepWizard, Step, ValidateFunction } from '../components/wizard/StepWizard';
import { WizardProvider, useWizard } from '../components/wizard/WizardContext';
import { ApiConfigStep, validateAuthConfig } from '../components/wizard/steps/ApiConfigStep';
import { EndpointSelectionStep } from '../components/wizard/steps/EndpointSelectionStep';
import { TestConfigStep } from '../components/wizard/steps/TestConfigStep';
import { ReviewLaunchStep } from '../components/wizard/steps/ReviewLaunchStep';
import { ResultsStep } from '../components/wizard/steps/ResultsStep';
import { SessionSidebar, Session } from '../components/SessionSidebar';
import { signOut, getCurrentUser } from '../lib/auth';
import { HeaderThemeToggle } from '../components/HeaderThemeToggle';
import { Footer } from '../components/Footer';
import apiService from '../services/ApiService';
import { TestSessionModal } from '../components/TestSessionModal';
import toast, { Toaster } from 'react-hot-toast';

// Create a wrapper function to inject validation functionality
function withValidation(Component: React.ComponentType<any>, validateFn: ValidateFunction) {
  // The function component that will be returned
  const WithValidation = (props: any) => <Component {...props} />;
  
  // Add the validate method to the function component
  WithValidation.validate = validateFn;
  
  return WithValidation;
}

// Super simplified validation that should just work
function createSimpleValidation(validate: ValidateFunction) {
  const ValidationWrapper = () => <div />;
  ValidationWrapper.validate = validate;
  return ValidationWrapper;
}

// API Config Step with validation
const ApiConfigWithValidation = () => {
  // Get relevant context values for validation
  const { authConfig, baseUrl } = useWizard();
  
  // Create a dummy component that just exposes validation
  const SimpleValidator = createSimpleValidation(() => {
    // Run validation directly
    if (!baseUrl || baseUrl.trim() === '') {
      console.log("VALIDATION FAILED: No base URL provided");
      return { valid: false, message: 'Please enter a base URL for the API' };
    }
    
    // Session cookie validation - simple direct version
    if (authConfig.method === 'session_cookie') {
      if (!authConfig.sessionCookie?.loginUrl) {
        console.log("VALIDATION FAILED: No login URL for session cookie auth");
        return { valid: false, message: 'Please enter a login endpoint URL' };
      }
      
      if (authConfig.sessionCookie.multipleAccounts) {
        if (!authConfig.sessionCookie.accountsList || authConfig.sessionCookie.accountsList.length === 0) {
          console.log("VALIDATION FAILED: No accounts for multiple account session cookie auth");
          return { valid: false, message: 'Please add at least one account' };
        }
      } else {
        if (!authConfig.sessionCookie?.credentials || Object.keys(authConfig.sessionCookie.credentials).length === 0) {
          console.log("VALIDATION FAILED: No credentials for session cookie auth");
          return { valid: false, message: 'Please provide login credentials' };
        }
      }
    }
    
    // Other auth methods - use the full validation
    if (authConfig.method !== 'none' && authConfig.method !== 'session_cookie') {
      const result = validateAuthConfig(authConfig, baseUrl);
      console.log("API Config validation:", result);
      return result;
    }
    
    console.log("VALIDATION PASSED!");
    return { valid: true };
  });
  
  return (
    <>
      <ApiConfigStep />
      <SimpleValidator />
    </>
  );
};

// Endpoint Selection Step with validation
const EndpointSelectionWithValidation = ({ onStepNext }: { onStepNext?: () => void }) => {
  const { selectedEndpoints } = useWizard();
  
  const ValidatedComponent = withValidation(
    EndpointSelectionStep,
    () => {
      if (!selectedEndpoints || selectedEndpoints.length === 0) {
        console.log("Endpoint validation failed: No endpoints selected");
        return { valid: false, message: 'Please select at least one endpoint to test' };
      }
      console.log("Endpoint validation passed:", selectedEndpoints.length, "endpoints selected");
      return { valid: true };
    }
  );
  
  // Pass the onStepNext prop to EndpointSelectionStep
  return <ValidatedComponent onStepNext={onStepNext} />;
};

// Test Config Step with validation
const TestConfigWithValidation = () => {
  const { concurrentRequests } = useWizard();
  
  const ValidatedComponent = withValidation(
    TestConfigStep,
    () => {
      if (!concurrentRequests || concurrentRequests <= 0) {
        console.log("TestConfig validation failed: Invalid concurrent requests:", concurrentRequests);
        return { valid: false, message: 'Please enter a valid number of concurrent requests' };
      }
      console.log("TestConfig validation passed:", concurrentRequests, "concurrent requests");
      return { valid: true };
    }
  );
  
  return <ValidatedComponent />;
};

export function WizardDashboard() {
  const navigate = useNavigate();
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        navigate('/login');
      } else {
        // Store the user's email
        setCurrentUserEmail(user.email || null);
      }
    } catch (error) {
      navigate('/login');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out. Please try again.');
    }
  };

  const handleSessionSelect = async (session: any) => {
    setSelectedSessionId(session.id);
    console.log('Selected session:', session);
  };
  
  const handleWelcomeCreateTestClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateNewTest = async (testDetails?: { 
    name: string; 
    description: string; 
    recurrence?: {
      type: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
      interval?: number;
      startDate?: string;
      startTime?: string;
    }
  }) => {
    // Close the modal if it was open
    setIsCreateModalOpen(false);
    
    if (!testDetails?.name) {
      // Just create an empty test without saving
      setSelectedSessionId('new');
      return;
    }
    
    // Show loading toast
    const loadingToast = toast.loading('Creating new test...');
    
    try {
      if (!currentUserEmail) {
        toast.error('User email is missing. Please try logging in again.');
        toast.dismiss(loadingToast);
        return;
      }
      
      console.log('Creating test for user:', currentUserEmail);
      
      // Create a new test session in the database
      const newSession = await apiService.createTestSession(
        currentUserEmail,
        testDetails.name,
        testDetails.description,
        testDetails.recurrence
      );
      
      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      toast.success(`Test "${testDetails.name}" created successfully`);
      
      // Select the newly created session
      setSelectedSessionId(newSession.id);
      
      // Refresh the sessions list to include the new session
      await fetchSessions();
      
      // Log success for debugging
      console.log(`Created new test: ${newSession.name} with ID ${newSession.id}`);
    } catch (error) {
      // Dismiss loading toast and show error
      toast.dismiss(loadingToast);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to create new test';
        
      console.error('Error creating new test:', error);
      
      // Only show error toast when not proceeding with fallback
      if (errorMessage.includes('Invalid email') || 
          errorMessage.includes('Required')) {
        toast.error(errorMessage);
      } else {
        // We'll show a different toast since we're using the fallback
        toast.error('Could not save test to server. Creating a local test instead.');
        
        // After a short delay, show an info toast
        setTimeout(() => {
          toast.success(`Test "${testDetails.name}" created locally`);
        }, 1500);
      }
      
      // Fall back to a new test with the provided details
      // We'll use a pseudo-ID to identify it locally
      const localId = `local_${new Date().getTime()}`;
      
      // Set the selected session ID to the local one
      setSelectedSessionId(localId);
      
      console.log(`Created local test with ID: ${localId}`);
    }
  };
  
  const handleRenameTest = async (id: string, name: string, description: string) => {
    const loadingToast = toast.loading('Updating test...');
    try {
      // Get the current session to preserve recurrence settings if they exist
      const currentSession = sessions.find(session => session.id === id);
      const recurrence = currentSession?.recurrence;
      
      // Make an API call to update the test on the server
      await apiService.updateTestSession(id, name, description, recurrence);
      
      toast.dismiss(loadingToast);
      toast.success('Test updated successfully');
      
      console.log(`Renamed test ${id} to ${name}`);
      
      // Refresh sessions list
      fetchSessions();
      
      return Promise.resolve();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to update test');
      console.error('Error renaming test:', error);
      return Promise.reject(error);
    }
  };

  const handleDeleteTest = async (id: string) => {
    const loadingToast = toast.loading('Deleting test...');
    try {
      // Make an API call to delete the test on the server
      await apiService.deleteTestSession(id);
      
      toast.dismiss(loadingToast);
      toast.success('Test deleted successfully');
      
      // If the deleted session was selected, clear the selection
      if (selectedSessionId === id) {
        setSelectedSessionId(undefined);
      }
      
      // Refresh sessions list
      fetchSessions();
      
      console.log(`Deleted test ${id}`);
      
      return Promise.resolve();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to delete test');
      console.error('Error deleting test:', error);
      return Promise.reject(error);
    }
  };
  
  const steps: Step[] = [
    {
      id: 'api-config',
      title: 'API Configuration',
      component: <ApiConfigWithValidation />
    },
    {
      id: 'endpoint-selection',
      title: 'Select Endpoints',
      component: <EndpointSelectionWithValidation />
    },
    {
      id: 'test-config',
      title: 'Test Configuration',
      component: <TestConfigWithValidation />
    },
    {
      id: 'review-launch',
      title: 'Review & Launch',
      component: <ReviewLaunchStep />,
      optional: true  // Make this step optional since it's just review
    },
    {
      id: 'results',
      title: 'Test Results',
      component: <ResultsStep />,
      optional: true  // This step shows results, should be optional
    }
  ];
  
  const handleWizardComplete = () => {
    console.log('Wizard completed!');
    // This is handled by the last step (ReviewLaunchStep) starting the test
    // We could add additional actions here if needed
  };
  
  const fetchSessions = async () => {
    if (!currentUserEmail) return;
    
    try {
      const data = await apiService.fetchUserSessions(currentUserEmail);
      if (data && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      } else {
        console.warn('Invalid sessions data:', data);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      toast.error('Failed to load your tests');
    }
  };

  useEffect(() => {
    if (currentUserEmail) {
      fetchSessions();
    }
  }, [currentUserEmail]);

  // Add this wrapper function to handle the sidebar create button click
  const handleSidebarCreateClick = () => {
    setIsCreateModalOpen(true);
  };
  
  return (
    <WizardProvider>
      {/* Toast container */}
      <Toaster 
        position="bottom-left"
        toastOptions={{
          style: {
            background: '#333',
            color: '#fff',
            borderRadius: '8px',
          },
          success: {
            duration: 3000,
            style: {
              background: '#10B981',
              color: '#fff',
            },
          },
          error: {
            duration: 5000,
            style: {
              background: '#EF4444',
              color: '#fff',
            },
          },
        }}
      />
      
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <nav className="bg-gradient-to-b from-gray-900 to-gray-800 border-b border-gray-700 text-white">
          <div className="container lg:px-12">
            <div className="flex items-center justify-between h-20">
              <div className="flex items-center pl-2">
                <Zap className="h-8 w-8 text-blue-500" />
                <span className="ml-2 text-xl font-bold">FastAPI Stress Tester</span>
              </div>
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="flex items-center bg-transparent text-gray-300 hover:text-white border-gray-600 hover:border-gray-500"
                >
                  <LogOut className="h-5 w-5 mr-1" />
                  Sign Out
                </Button>
                <HeaderThemeToggle />
              </div>
            </div>
          </div>
        </nav>

        <div className="flex flex-1 overflow-hidden">
          {/* Session Sidebar */}
          <SessionSidebar 
            onSessionSelect={handleSessionSelect}
            selectedSessionId={selectedSessionId}
            userEmail={currentUserEmail}
            onCreateNewTest={handleSidebarCreateClick}
            onRenameTest={handleRenameTest}
            onDeleteTest={handleDeleteTest}
          />

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto p-6">
            {!selectedSessionId ? (
              <div className="h-full flex items-center justify-center">
                <div className="max-w-2xl w-full bg-white dark:bg-gray-800 shadow-sm rounded-lg p-8 text-center">
                  <div className="flex justify-center mb-6">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full">
                      <LineChart className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
                    Welcome to FastAPI Stress Tester
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-lg mx-auto">
                    Create a new test to get started or select an existing session from the sidebar.
                    Our stress testing tool helps you evaluate your API performance under various load conditions.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button 
                      onClick={handleWelcomeCreateTestClick}
                      size="lg"
                      className="flex items-center justify-center"
                    >
                      <PlusCircle className="h-5 w-5 mr-2" />
                      Create New Test
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto">
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
                  <WizardContent 
                    steps={steps}
                    selectedSessionId={selectedSessionId}
                    sessions={sessions}
                    onComplete={handleWizardComplete}
                  />
                </div>
              </div>
            )}
          </main>
        </div>
        <Footer />
      </div>
      {/* Create New Test Modal */}
      <TestSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateNewTest}
        title="Create New Test"
      />
    </WizardProvider>
  );
}

// New component that handles wizard context operations
function WizardContent({ 
  steps, 
  selectedSessionId, 
  sessions, 
  onComplete 
}: { 
  steps: Step[]; 
  selectedSessionId: string | undefined; 
  sessions: Session[];
  onComplete: () => void;
}) {
  const wizardContext = useWizard();
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Effect to set the active test ID when a session is selected - only run once per session ID change
  useEffect(() => {
    if (!selectedSessionId) return;
    
    // Set the active test ID
    wizardContext.setActiveTestId(selectedSessionId);
    
    // Find the session in the sessions list
    const session = sessions.find(s => s.id === selectedSessionId);
    if (session) {
      loadSessionState(session);
    } else {
      resetWizardState();
    }
    
    setHasInitialized(true);
    
    // Remove wizardContext from dependencies to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId, sessions]);
  
  // Function to load session state from configuration without causing re-renders
  const loadSessionState = (session: any) => {
    console.log('Loading session state from:', session.id);
    
    // Check if the session has configuration with saved state
    if (!session.configurations || session.configurations.length === 0) {
      resetWizardState();
      return;
    }
    
    const config = session.configurations[0]; // Use the first configuration
    if (!config) {
      resetWizardState();
      return;
    }
    
    try {
      // Prepare all state changes first, then apply them in batches
      let baseUrl = '';
      let concurrentRequests = 10;
      let endpoints: any[] = [];
      let selectedEndpointsList: string[] = [];
      let distributionMode: any = 'sequential';
      let strategyOptions = wizardContext.strategyOptions;
      let authConfig = { method: 'none' as const };
      let currentStep = 0;
      let activeEndpointTab = 'all';
      let endpointMethodFilter = 'all';
      let showAdvancedOptions = false;
      
      // Process saved state if it exists
      if (config.success_criteria) {
        const savedState = config.success_criteria;
        
        // Extract and prepare values without setting state yet
        if (savedState.target_url) baseUrl = savedState.target_url;
        if (typeof savedState.concurrent_users === 'number') concurrentRequests = savedState.concurrent_users;
        
        // Prepare endpoints data
        if (savedState.endpoints && Array.isArray(savedState.endpoints)) {
          selectedEndpointsList = savedState.endpoints;
          
          if (wizardContext.endpoints.length === 0) {
            endpoints = savedState.endpoints.map((endpoint: string) => {
              const [method, path] = endpoint.split(' ');
              return {
                method,
                path,
                description: '',
                summary: '',
                parameters: [],
                responses: {}
              };
            });
          }
        }
        
        // Prepare other settings
        if (savedState.strategy) distributionMode = savedState.strategy;
        if (savedState.strategy_options) strategyOptions = savedState.strategy_options;
        
        // Prepare auth config
        if (savedState.auth && savedState.auth.method) {
          // Create a new auth config with the right method first
          const newAuthConfig = { method: savedState.auth.method };
          
          // Then merge with full config if available
          if (savedState.auth.config) {
            authConfig = {...newAuthConfig, ...savedState.auth.config};
          } else {
            authConfig = newAuthConfig;
          }
        }
        
        // Prepare UI state
        if (savedState.ui_state) {
          if (typeof savedState.ui_state.currentStep === 'number') currentStep = savedState.ui_state.currentStep;
          if (savedState.ui_state.activeEndpointTab) activeEndpointTab = savedState.ui_state.activeEndpointTab;
          if (savedState.ui_state.endpointMethodFilter) endpointMethodFilter = savedState.ui_state.endpointMethodFilter;
          if (typeof savedState.ui_state.showAdvancedOptions === 'boolean') {
            showAdvancedOptions = savedState.ui_state.showAdvancedOptions;
          }
        }
      } else if (config.endpoint_url) {
        // Simple legacy fallback if no full state is available
        baseUrl = config.endpoint_url;
        concurrentRequests = config.concurrent_users || 10;
      }
      
      // Now apply all the state changes
      wizardContext.setBaseUrl(baseUrl);
      wizardContext.setConcurrentRequests(concurrentRequests);
      
      if (endpoints.length > 0) {
        wizardContext.setEndpoints(endpoints);
      }
      
      wizardContext.setSelectedEndpoints(selectedEndpointsList);
      wizardContext.setDistributionMode(distributionMode);
      wizardContext.setStrategyOptions(strategyOptions);
      wizardContext.setAuthConfig(authConfig);
      wizardContext.setActiveEndpointTab(activeEndpointTab);
      wizardContext.setEndpointMethodFilter(endpointMethodFilter);
      wizardContext.setShowAdvancedOptions(showAdvancedOptions);
      
      // Set current step last to prevent premature validation
      setTimeout(() => {
        wizardContext.setCurrentStep(currentStep);
      }, 0);
    } catch (error) {
      console.error('Error restoring session state:', error);
      resetWizardState();
    }
  };
  
  // Helper to reset wizard state to defaults without causing multiple re-renders
  const resetWizardState = () => {
    console.log('Resetting wizard state to defaults');
    
    // Apply defaults in a batch
    wizardContext.setBaseUrl('');
    wizardContext.setAuthConfig({ method: 'none' });
    wizardContext.setEndpoints([]);
    wizardContext.setSelectedEndpoints([]);
    wizardContext.setConcurrentRequests(10);
    wizardContext.setDistributionMode('sequential');
    wizardContext.setActiveEndpointTab('all');
    wizardContext.setEndpointMethodFilter('all');
    wizardContext.setShowAdvancedOptions(false);
    
    // Set step last to prevent premature validation
    setTimeout(() => {
      wizardContext.setCurrentStep(0);
    }, 0);
  };
  
  // Don't render the wizard until we've initialized the state
  if (selectedSessionId && !hasInitialized && sessions.length > 0) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>;
  }
  
  return (
    <StepWizard 
      steps={steps}
      onComplete={onComplete}
    />
  );
} 