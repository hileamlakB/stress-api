import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Settings, LogOut } from 'lucide-react';
import { Button } from '../components/Button';
import { StepWizard } from '../components/wizard/StepWizard';
import { WizardProvider } from '../components/wizard/WizardContext';
import { ApiConfigStep } from '../components/wizard/steps/ApiConfigStep';
import { EndpointSelectionStep } from '../components/wizard/steps/EndpointSelectionStep';
import { TestConfigStep } from '../components/wizard/steps/TestConfigStep';
import { ReviewLaunchStep } from '../components/wizard/steps/ReviewLaunchStep';
import { ResultsStep } from '../components/wizard/steps/ResultsStep';
import { SessionSidebar } from '../components/SessionSidebar';
import { signOut, getCurrentUser } from '../lib/auth';
import { HeaderThemeToggle } from '../components/HeaderThemeToggle';
import { Footer } from '../components/Footer';

export function WizardDashboard() {
  const navigate = useNavigate();
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  
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
  
  return (
    <WizardProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <nav className="bg-gradient-to-b from-gray-900 to-gray-800 border-b border-gray-700 text-white">
          <div className="container mx-auto px-6 lg:px-12">
            <div className="flex items-center justify-between h-20">
              <div className="flex items-center pl-2">
                <Zap className="h-8 w-8 text-blue-500" />
                <span className="ml-2 text-xl font-bold">FastAPI Stress Tester</span>
              </div>
              <div className="flex items-center space-x-5 pr-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {}}
                  className="flex items-center bg-transparent text-gray-300 hover:text-white border-gray-600 hover:border-gray-500"
                >
                  <Settings className="h-5 w-5 mr-1" />
                  Settings
                </Button>
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
          />

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto">
              <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
                <StepWizard 
                  steps={steps} 
                  onComplete={handleWizardComplete}
                />
              </div>
            </div>
          </main>
        </div>
        <Footer />
      </div>
    </WizardProvider>
  );
} 