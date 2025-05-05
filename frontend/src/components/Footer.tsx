// React import removed as it's not needed with modern JSX transform
import { Link } from 'react-router-dom';
import { Github, Code, Zap, Mail, ExternalLink, HeartPulse, BookOpen } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gradient-to-b from-gray-800 to-gray-900 border-t border-gray-700 text-gray-300 mt-auto py-10">
      <div className="container mx-auto px-6">
        {/* Top section with logo and description */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-8">
          <div className="mb-8 md:mb-0 max-w-md">
            <div className="flex items-center mb-4">
              <Zap className="h-6 w-6 text-blue-500 mr-2" />
              <h3 className="text-xl font-bold text-white">FastAPI Stress Tester</h3>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              A powerful open-source platform for load testing and performance monitoring of 
              FastAPI applications. Simulate real-world traffic patterns and identify 
              bottlenecks before they impact your users.
            </p>
            <div className="flex space-x-5 mt-4">
              <a
                href="https://github.com/hileamlakB/stress-api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Center columns with useful links */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 w-full md:w-auto">
            {/* Product links */}
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Product</h4>
              <nav className="flex flex-col space-y-3 text-sm">
                <Link to="/wizard" className="text-gray-400 hover:text-white transition-colors flex items-center">
                  <Zap className="h-3.5 w-3.5 mr-2" />
                  Step Wizard
                </Link>
                <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors flex items-center">
                  <HeartPulse className="h-3.5 w-3.5 mr-2" />
                  Dashboard
                </Link>
                <a href="/docs" className="text-gray-400 hover:text-white transition-colors flex items-center">
                  <BookOpen className="h-3.5 w-3.5 mr-2" />
                  Documentation
                </a>
              </nav>
            </div>

            {/* Resources links */}
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Resources</h4>
              <nav className="flex flex-col space-y-3 text-sm">
                <a 
                  href="https://fastapi.tiangolo.com/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors flex items-center"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  FastAPI Docs
                </a>
                <a 
                  href="https://github.com/hileamlakB/stress-api/issues" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors flex items-center"
                >
                  <Code className="h-3.5 w-3.5 mr-2" />
                  Report Issues
                </a>
              </nav>
            </div>

            {/* Company links */}
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Company</h4>
              <nav className="flex flex-col space-y-3 text-sm">
                <Link to="/about" className="text-gray-400 hover:text-white transition-colors">
                  About Us
                </Link>
                <Link to="/login" className="text-gray-400 hover:text-white transition-colors">
                  Sign In
                </Link>
                <Link to="/register" className="text-gray-400 hover:text-white transition-colors">
                  Register
                </Link>
                <a 
                  href="mailto:support@example.com" 
                  className="text-gray-400 hover:text-white transition-colors flex items-center"
                >
                  <Mail className="h-3.5 w-3.5 mr-2" />
                  Contact
                </a>
              </nav>
            </div>
          </div>
        </div>

        {/* Bottom section with copyright and legal links */}
        <div className="pt-8 border-t border-gray-700/50 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-500 mb-4 md:mb-0">
            &copy; {currentYear} FastAPI Stress Tester. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center space-x-6 text-xs text-gray-500">
            <Link to="/privacy" className="hover:text-gray-300 transition-colors mb-2 md:mb-0">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-gray-300 transition-colors mb-2 md:mb-0">
              Terms of Service
            </Link>
            <Link to="/cookies" className="hover:text-gray-300 transition-colors mb-2 md:mb-0">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}