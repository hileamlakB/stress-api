import { Link, useNavigate } from 'react-router-dom';
import { Activity, Zap, BarChart3 } from 'lucide-react';
import { Button } from '../components/Button';
import { Footer } from '../components/Footer';
import { HeaderThemeToggle } from '../components/HeaderThemeToggle';
import { getCurrentUser } from '../lib/auth';
import { useEffect, useState } from 'react';

export function LandingPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  // Check authentication status when the component mounts
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        setIsAuthenticated(!!user);
      } catch (error) {
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // Handle navigation with auth check
  const handleNavigation = async (destination: string) => {
    // If we've already checked auth status, use that information
    if (isAuthenticated) {
      navigate('/wizard');
      return;
    }
    
    // If we haven't checked yet or need to check again
    try {
      const user = await getCurrentUser();
      if (user) {
        navigate('/wizard');
      } else {
        navigate(destination);
      }
    } catch (error) {
      navigate(destination);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gradient-to-b dark:from-gray-900 dark:to-gray-800 dark:text-white">
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="h-8 w-8 text-blue-500" />
            <span className="text-xl font-bold">FastAPI Stress Tester</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => handleNavigation('/login')}
            >
              Login
            </Button>
            <Button onClick={() => handleNavigation('/register')}>
              Sign Up
            </Button>
            <HeaderThemeToggle />
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Test Your FastAPI Applications
            <br />
            <span className="text-blue-500">With Confidence</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            A powerful stress testing tool designed specifically for FastAPI applications.
            Monitor performance, analyze bottlenecks, and ensure your API can handle the load.
          </p>
          <div className="flex justify-center space-x-4">
            <Button 
              size="lg" 
              className="animate-pulse"
              onClick={() => handleNavigation('/register')}
            >
                Get Started
              </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg">
            <Activity className="h-12 w-12 text-blue-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Real-time Monitoring</h3>
            <p className="text-gray-400">
              Watch your API performance in real-time with detailed metrics and insights.
            </p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg">
            <BarChart3 className="h-12 w-12 text-blue-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Comprehensive Analytics</h3>
            <p className="text-gray-400">
              Get detailed reports and visualizations of your API's performance under load.
            </p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg">
            <Zap className="h-12 w-12 text-blue-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Multiple Test Strategies</h3>
            <p className="text-gray-400">
              Choose from various testing strategies to simulate real-world scenarios.
            </p>
          </div>
        </div>
      </main>
      {/* Testimonials Section */}
      <section className="bg-gray-50 dark:bg-gray-900 py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold mb-8">What developers are saying</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <p className="text-gray-300 italic mb-4">
                "This tool uncovered bottlenecks we never would have found in staging."
              </p>
              <span className="font-semibold text-white">— Alex P., Backend Lead</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <p className="text-gray-300 italic mb-4">
                "The wizard made configuring complex load tests a breeze."
              </p>
              <span className="font-semibold text-white">— Maria L., DevOps Engineer</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <p className="text-gray-300 italic mb-4">
                "Our API handled 10x traffic after optimizing with these insights."
              </p>
              <span className="font-semibold text-white">— Chen W., CTO</span>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}