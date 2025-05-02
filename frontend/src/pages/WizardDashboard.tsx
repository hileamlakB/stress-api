import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, LogOut, PlusCircle, ArrowRight, LineChart } from 'lucide-react';
import { Button } from '../components/Button';
import { StepWizard } from '../components/wizard/StepWizard';
import { WizardProvider } from '../components/wizard/WizardContext';
import { ApiConfigStep } from '../components/wizard/steps/ApiConfigStep';
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
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSessionSelect = (session: any) => {
    setSelectedSessionId(session.id);
    console.log('Selected session:', session);
    // Note: The context would handle loading the session configuration
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
    
    try {
      if (currentUserEmail) {
        // Create a new test session in the database
        const newSession = await apiService.createTestSession(
          currentUserEmail,
          testDetails.name,
          testDetails.description,
          testDetails.recurrence
        );
        
        // Select the newly created session
        setSelectedSessionId(newSession.id);
        
        // Refresh the sessions list to include the new session
        await fetchSessions();
        
        // Log success for debugging
        console.log(`Created new test: ${newSession.name} with ID ${newSession.id}`);
      }
    } catch (error) {
      console.error('Error creating new test:', error);
      alert('Failed to create new test. Please try again.');
      
      // Fall back to a blank test
      setSelectedSessionId('new');
    }
  };
  
  const handleRenameTest = async (id: string, name: string, description: string) => {
    try {
      // Get the current session to preserve recurrence settings if they exist
      const currentSession = sessions.find(session => session.id === id);
      const recurrence = currentSession?.recurrence;
      
      // Make an API call to update the test on the server
      await apiService.updateTestSession(id, name, description, recurrence);
      
      console.log(`Renamed test ${id} to ${name}`);
      
      // Refresh sessions list
      fetchSessions();
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error renaming test:', error);
      return Promise.reject(error);
    }
  };

  const handleDeleteTest = async (id: string) => {
    try {
      // Make an API call to delete the test on the server
      await apiService.deleteTestSession(id);
      
      // If the deleted session was selected, clear the selection
      if (selectedSessionId === id) {
        setSelectedSessionId(undefined);
      }
      
      console.log(`Deleted test ${id}`);
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error deleting test:', error);
      return Promise.reject(error);
    }
  };
  
  const steps = [
    {
      id: 'api-config',
      title: 'API Configuration',
      component: <ApiConfigStep />
    },
    {
      id: 'endpoint-selection',
      title: 'Select Endpoints',
      component: <EndpointSelectionStep />
    },
    {
      id: 'test-config',
      title: 'Test Configuration',
      component: <TestConfigStep />
    },
    {
      id: 'review-launch',
      title: 'Review & Launch',
      component: <ReviewLaunchStep />
    },
    {
      id: 'results',
      title: 'Test Results',
      component: <ResultsStep />
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
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
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
                  <StepWizard 
                    steps={steps} 
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