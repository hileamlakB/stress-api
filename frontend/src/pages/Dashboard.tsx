import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Settings, LogOut, ChevronRight, Play } from 'lucide-react';
import { Button } from '../components/Button';
import { signOut, getCurrentUser } from '../lib/auth';
import { MetricsPanel } from '../components/MetricsPanel';
import { DemoMetricsPanel } from '../components/DemoMetricsPanel';

export function Dashboard() {
  const [apiUrl, setApiUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        navigate('/login');
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

  const startLoadTest = async () => {
    if (!apiUrl) {
      alert('Please enter an API URL');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/tests/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: apiUrl }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to start load test');
      }

      const data = await response.json();
      setActiveTestId(data.testId);
    } catch (error) {
      console.error('Error starting load test:', error);
      alert('Failed to start load test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Zap className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold">Stress Tester</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {}}
                className="flex items-center"
              >
                <Settings className="h-5 w-5 mr-1" />
                Settings
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center"
              >
                <LogOut className="h-5 w-5 mr-1" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Start New Load Test</h2>
          <div className="flex space-x-4">
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="Enter API URL to test"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button
              onClick={startLoadTest}
              disabled={loading}
              className="flex items-center"
            >
              <Play className="h-5 w-5 mr-1" />
              {loading ? 'Starting...' : 'Start Test'}
            </Button>
          </div>
        </div>

        {activeTestId ? (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Live Metrics</h2>
              <p className="text-sm text-gray-500">Test ID: {activeTestId}</p>
            </div>
            <MetricsPanel testId={activeTestId} />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Example Visualization</h2>
              <p className="text-sm text-gray-500">This is how your metrics will look during a load test</p>
            </div>
            <DemoMetricsPanel />
          </div>
        )}
      </main>
    </div>
  );
}