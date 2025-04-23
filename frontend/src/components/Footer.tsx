import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gradient-to-b from-gray-800 to-gray-900 border-t border-gray-700 text-gray-400 mt-auto">
      <div className="container mx-auto px-6 py-4 grid md:grid-cols-3 gap-6">
        {/* Brand / Description */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">FastAPI Stress Tester</h3>
          <p className="text-sm max-w-xs">
            An open‑source platform for load testing and monitoring FastAPI applications.
          </p>
        </div>

        {/* Navigation links */}
        <div>
          <h4 className="text-white font-semibold mb-4">Navigation</h4>
          <nav className="flex flex-col space-y-2 text-sm">
            <Link to="/" className="hover:text-white">Home</Link>
            <Link to="/wizard" className="hover:text-white">Step Wizard</Link>
            <Link to="/login" className="hover:text-white">Login</Link>
            <Link to="/register" className="hover:text-white">Sign Up</Link>
          </nav>
        </div>

        {/* Contact / social */}
        <div>
          <h4 className="text-white font-semibold mb-4">Connect</h4>
          <div className="flex space-x-4 mt-2">
            <a
              href="https://github.com/hileamlakyitayew"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              <Github className="h-5 w-5" />
            </a>
            <a
              href="https://twitter.com/yourhandle"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              <Twitter className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="border-t border-gray-700 text-center text-xs py-2 text-gray-500">
        © {new Date().getFullYear()} FastAPI Stress Tester. All rights reserved.
      </div>
    </footer>
  );
} 