import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, LogOut, LayoutDashboard, Moon, Sun } from 'lucide-react';
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
import { useTheme } from '../contexts/ThemeContext';

export function WizardDashboard() {
  const navigate = useNavigate();
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const { isDarkMode, toggleDarkMode } = useTheme();
  
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
      <div className="min-h-screen bg-white dark:bg-gray-900">
        {/* Navigation Bar */}
        <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <Zap className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                <span className="ml-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                  FastAPI Stress Tester
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <Link to="/dashboard">
                  <Button variant="ghost" className="flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Classic View</span>
                  </Button>
                </Link>
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Toggle dark mode"
                >
                  {isDarkMode ? (
                    <Sun className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-600" />
                  )}
                </button>
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  className="flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <div className="flex min-h-screen">
          {/* Session Sidebar */}
          <SessionSidebar
            onSessionSelect={handleSessionSelect}
            selectedSessionId={selectedSessionId}
            userEmail={currentUserEmail}
          />

          {/* Main Content Area */}
          <div className="flex-1 bg-gray-50 dark:bg-gray-900">
            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              <div className="px-4 sm:px-0">
                <StepWizard steps={steps} onComplete={handleWizardComplete} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </WizardProvider>
  );
}