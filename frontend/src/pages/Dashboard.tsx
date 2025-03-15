import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Settings, LogOut, ChevronRight } from 'lucide-react';
import { Button } from '../components/Button';
import { signOut, getCurrentUser } from '../lib/auth';

export function Dashboard() {
  const [apiUrl, setApiUrl] = useState('');
  const [loading, setLoading] = useState(false);
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

  const handleFetchEndpoints = async () => {
    setLoading(true);
    try {
      // TODO: Implement endpoint fetching
    } catch (error) {
      console.error('Error fetching endpoints:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <Zap className="h-6 w-6 text-blue-500" />
              <span className="text-lg font-semibold text-gray-900">FastAPI Stress Tester</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="secondary" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="apple-card p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">API Configuration</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="apiUrl" className="block text-sm font-medium text-gray-700 mb-1">
                FastAPI Base URL
              </label>
              <div className="flex space-x-4">
                <input
                  id="apiUrl"
                  type="url"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  className="apple-input flex-1"
                />
                <Button
                  onClick={handleFetchEndpoints}
                  disabled={!apiUrl || loading}
                >
                  {loading ? 'Fetching...' : 'Fetch Endpoints'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="apple-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Available Endpoints</h3>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-gray-600">No endpoints fetched yet. Enter an API URL above to begin.</p>
          </div>
          
          <div className="apple-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Test Configuration</h3>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-gray-600">Select an endpoint to configure stress test parameters.</p>
          </div>
        </div>
      </main>
    </div>
  );
}