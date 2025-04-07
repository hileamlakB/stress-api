import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Zap, BarChart3, Wand2 } from 'lucide-react';
import { Button } from '../components/Button';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="h-8 w-8 text-blue-500" />
            <span className="text-xl font-bold">FastAPI Stress Tester</span>
          </div>
          <div className="space-x-4">
            <Link to="/login">
              <Button variant="outline">Login</Button>
            </Link>
            <Link to="/register">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-6">
            Test Your FastAPI Applications
            <br />
            <span className="text-blue-500">With Confidence</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            A powerful stress testing tool designed specifically for FastAPI applications.
            Monitor performance, analyze bottlenecks, and ensure your API can handle the load.
          </p>
          <div className="flex justify-center space-x-4">
            <Link to="/register">
              <Button size="lg" className="animate-pulse">
                Get Started
              </Button>
            </Link>
            <Link to="/wizard">
              <Button size="lg" variant="outline" className="flex items-center">
                <Wand2 className="h-5 w-5 mr-2" />
                Try Step Wizard
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-gray-800 p-6 rounded-lg">
            <Activity className="h-12 w-12 text-blue-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Real-time Monitoring</h3>
            <p className="text-gray-400">
              Watch your API performance in real-time with detailed metrics and insights.
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <BarChart3 className="h-12 w-12 text-blue-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Comprehensive Analytics</h3>
            <p className="text-gray-400">
              Get detailed reports and visualizations of your API's performance under load.
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <Zap className="h-12 w-12 text-blue-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Multiple Test Strategies</h3>
            <p className="text-gray-400">
              Choose from various testing strategies to simulate real-world scenarios.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}