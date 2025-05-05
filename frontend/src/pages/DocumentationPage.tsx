import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Zap, Code, ServerCrash, BookOpen, Settings, Database, GitBranch, Airplay } from 'lucide-react';
import { Footer } from '../components/Footer';
import { HeaderThemeToggle } from '../components/HeaderThemeToggle';
import { Button } from '../components/Button';

type DocSection = {
  id: string;
  title: string;
  icon: JSX.Element;
  content: React.ReactNode;
}

export function DocumentationPage() {
  const [openSection, setOpenSection] = useState<string | null>('getting-started');

  const toggleSection = (id: string) => {
    setOpenSection(openSection === id ? null : id);
  };
  
  const sections: DocSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: <Zap className="h-5 w-5 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Welcome to FastAPI Stress Tester</h3>
          <p>
            FastAPI Stress Tester is a powerful tool designed to help you validate the performance of your 
            FastAPI applications under various load conditions. Our tool lets you simulate real-world traffic 
            patterns and identify bottlenecks before they impact your users.
          </p>
          <h4 className="font-medium text-lg mt-4">Quick Start</h4>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Create an account or sign in to your existing account</li>
            <li>Use the step wizard to configure your API settings</li>
            <li>Select endpoints to test and configure test parameters</li>
            <li>Run the test and analyze the results</li>
          </ol>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md mt-4">
            <p className="text-sm">
              <strong>Tip:</strong> For best results, test your API with realistic load patterns that 
              match your expected production traffic.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'api-configuration',
      title: 'API Configuration',
      icon: <Settings className="h-5 w-5 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Configuring Your API</h3>
          <p>
            The first step in using our stress tester is configuring your API connections. You can provide:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Base URL for your FastAPI application</li>
            <li>Authentication method (None, API Key, Bearer Token, or Session Cookie)</li>
            <li>Custom headers and request parameters</li>
          </ul>
          <h4 className="font-medium text-lg mt-4">Authentication Methods</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="border dark:border-gray-700 rounded-md p-4">
              <h5 className="font-medium">API Key</h5>
              <p className="text-sm mt-1">Provide your API key and specify whether it should be sent in the headers, query parameters, or cookies.</p>
            </div>
            <div className="border dark:border-gray-700 rounded-md p-4">
              <h5 className="font-medium">Bearer Token</h5>
              <p className="text-sm mt-1">Provide your JWT or OAuth token to authenticate requests.</p>
            </div>
            <div className="border dark:border-gray-700 rounded-md p-4">
              <h5 className="font-medium">Session Cookie</h5>
              <p className="text-sm mt-1">Authenticate using cookies for session-based APIs.</p>
            </div>
            <div className="border dark:border-gray-700 rounded-md p-4">
              <h5 className="font-medium">Basic Auth</h5>
              <p className="text-sm mt-1">Use username and password authentication.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'endpoint-selection',
      title: 'Endpoint Selection',
      icon: <Airplay className="h-5 w-5 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Selecting Endpoints for Testing</h3>
          <p>
            After configuring your API connection, you need to select which endpoints to test:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>FastAPI Stress Tester automatically discovers available endpoints from your OpenAPI schema</li>
            <li>You can filter endpoints by method (GET, POST, PUT, DELETE, etc.)</li>
            <li>For each endpoint, you can configure test data and parameters</li>
          </ul>
          <h4 className="font-medium text-lg mt-4">OpenAPI Integration</h4>
          <p>
            Our tool works best with FastAPI's built-in OpenAPI documentation. If your API has OpenAPI documentation 
            enabled, we can automatically discover and configure all available endpoints.
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md mt-4">
            <p className="text-sm">
              <strong>Note:</strong> For non-standard endpoints or APIs without OpenAPI documentation, 
              you can manually configure endpoints and test data.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'test-configuration',
      title: 'Test Configuration',
      icon: <ServerCrash className="h-5 w-5 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Configuring Your Load Tests</h3>
          <p>
            Configure your load testing parameters to simulate realistic scenarios:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Concurrent Users: Set the number of simultaneous requests (1-50)</li>
            <li>Request Distribution: Choose how requests are distributed across endpoints</li>
            <li>Test Duration: Set how long the test should run</li>
            <li>Ramp-up Period: Gradually increase load to prevent immediate spikes</li>
          </ul>
          <h4 className="font-medium text-lg mt-4">Distribution Strategies</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div className="border dark:border-gray-700 rounded-md p-4">
              <h5 className="font-medium">Sequential</h5>
              <p className="text-sm mt-1">Requests are sent one after another in order.</p>
            </div>
            <div className="border dark:border-gray-700 rounded-md p-4">
              <h5 className="font-medium">Interleaved</h5>
              <p className="text-sm mt-1">Requests are distributed evenly across endpoints.</p>
            </div>
            <div className="border dark:border-gray-700 rounded-md p-4">
              <h5 className="font-medium">Random</h5>
              <p className="text-sm mt-1">Requests are sent randomly to selected endpoints.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'test-data',
      title: 'Test Data Generation',
      icon: <Database className="h-5 w-5 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Generating Test Data</h3>
          <p>
            For endpoints that require request bodies (like POST or PUT requests), you can configure test data:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>JSON Schema-based generation: Automatically generate data based on your API schema</li>
            <li>Custom data sets: Define your own data for specific testing scenarios</li>
            <li>Dynamic variables: Use variables that change with each request (timestamps, UUIDs, etc.)</li>
          </ul>
          <h4 className="font-medium text-lg mt-4">Data Templates</h4>
          <p>
            You can save data templates for reuse across multiple test sessions.
          </p>
          <div className="mt-4 bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto">
            <pre className="text-sm"><code>{`{
  "user": {
    "name": "{{faker.name.fullName}}",
    "email": "{{faker.internet.email}}",
    "age": "{{random.number.range(18,65)}}"
  }
}`}</code></pre>
          </div>
        </div>
      )
    },
    {
      id: 'analyzing-results',
      title: 'Analyzing Results',
      icon: <GitBranch className="h-5 w-5 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Understanding Test Results</h3>
          <p>
            After running a test, you'll get comprehensive results to help identify performance issues:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Response Time: Average, minimum, maximum, and percentiles (p50, p90, p99)</li>
            <li>Throughput: Requests per second handled by your API</li>
            <li>Error Rate: Percentage of failed requests and error types</li>
            <li>Status Codes: Distribution of HTTP status codes</li>
          </ul>
          <h4 className="font-medium text-lg mt-4">Performance Insights</h4>
          <p>
            Our analysis helps you identify bottlenecks and areas for optimization:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Slowest Endpoints: Identify which endpoints have the highest response times</li>
            <li>Error Patterns: Find patterns in error responses</li>
            <li>Concurrency Impact: See how increasing concurrent users affects performance</li>
          </ul>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md mt-4">
            <p className="text-sm">
              <strong>Tip:</strong> Compare results from multiple test runs to track improvements over time.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'api-reference',
      title: 'API Reference',
      icon: <Code className="h-5 w-5 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">REST API Reference</h3>
          <p>
            FastAPI Stress Tester also provides a REST API that you can integrate with your CI/CD pipeline:
          </p>
          <div className="mt-4 space-y-6">
            <div>
              <h4 className="font-medium">Authentication</h4>
              <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto">
                <pre className="text-sm"><code>{`POST /api/auth/token
{
  "email": "your-email@example.com",
  "password": "your-password"
}`}</code></pre>
              </div>
            </div>
            <div>
              <h4 className="font-medium">Create Test Session</h4>
              <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto">
                <pre className="text-sm"><code>{`POST /api/sessions
{
  "name": "API Performance Test",
  "description": "Testing API under load",
  "user_email": "your-email@example.com"
}`}</code></pre>
              </div>
            </div>
            <div>
              <h4 className="font-medium">Configure Test</h4>
              <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto">
                <pre className="text-sm"><code>{`PUT /api/sessions/{session_id}/configuration
{
  "endpoint_url": "https://api.example.com",
  "concurrent_users": 10,
  "auth": {
    "method": "bearer_token",
    "token": "your-auth-token"
  },
  "endpoints": ["GET /users", "POST /users"]
}`}</code></pre>
              </div>
            </div>
            <div>
              <h4 className="font-medium">Run Test</h4>
              <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto">
                <pre className="text-sm"><code>{`POST /api/sessions/{session_id}/run
{
  "duration_seconds": 60
}`}</code></pre>
              </div>
            </div>
            <div>
              <h4 className="font-medium">Get Results</h4>
              <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto">
                <pre className="text-sm"><code>{`GET /api/sessions/{session_id}/results`}</code></pre>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'best-practices',
      title: 'Best Practices',
      icon: <BookOpen className="h-5 w-5 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Load Testing Best Practices</h3>
          <p>
            Follow these recommendations to get the most accurate and useful results:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Test in an environment similar to production</strong> - Use similar hardware, database size, and configurations</li>
            <li><strong>Start with baseline tests</strong> - Establish performance baselines before making changes</li>
            <li><strong>Gradually increase load</strong> - Start with low concurrency and gradually increase to find breaking points</li>
            <li><strong>Test regularly</strong> - Integrate performance testing into your development process</li>
            <li><strong>Monitor system resources</strong> - Watch CPU, memory, and database performance during tests</li>
            <li><strong>Use realistic data</strong> - Test with data volumes and patterns similar to real usage</li>
          </ul>
          <h4 className="font-medium text-lg mt-4">Common Performance Issues</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="border dark:border-gray-700 rounded-md p-4">
              <h5 className="font-medium">N+1 Query Problem</h5>
              <p className="text-sm mt-1">When code makes one database query to fetch a list of items, then additional queries for each item.</p>
            </div>
            <div className="border dark:border-gray-700 rounded-md p-4">
              <h5 className="font-medium">Missing Indexes</h5>
              <p className="text-sm mt-1">Database queries that could benefit from proper indexing.</p>
            </div>
            <div className="border dark:border-gray-700 rounded-md p-4">
              <h5 className="font-medium">Connection Pool Exhaustion</h5>
              <p className="text-sm mt-1">When all available database connections are in use, causing new requests to wait.</p>
            </div>
            <div className="border dark:border-gray-700 rounded-md p-4">
              <h5 className="font-medium">Memory Leaks</h5>
              <p className="text-sm mt-1">Gradual memory consumption that doesn't get released properly.</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Header/Navigation */}
      <nav className="bg-gradient-to-b from-gray-900 to-gray-800 border-b border-gray-700 text-white sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <Zap className="h-8 w-8 text-blue-500" />
              <span className="text-xl font-bold">FastAPI Stress Tester</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link to="/wizard">
                <Button variant="outline" className="bg-transparent text-gray-300 hover:text-white border-transparent hover:border-gray-600">
                  Dashboard
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="bg-transparent text-gray-300 hover:text-white border-gray-600">
                  Login
                </Button>
              </Link>
              <HeaderThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="container mx-auto px-6 py-12 flex-grow">
        <div className="flex flex-col md:flex-row gap-8 relative">
          {/* Sidebar */}
          <div className="md:w-64 shrink-0">
            <div className="sticky top-24">
              <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Documentation</h2>
              <div className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => toggleSection(section.id)}
                    className={`flex items-center justify-between w-full text-left p-3 rounded-md ${
                      openSection === section.id
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="flex items-center">
                      {section.icon}
                      <span className="ml-2 font-medium">{section.title}</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        openSection === section.id ? 'transform rotate-180' : ''
                      }`}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-md">
                <h3 className="font-medium text-blue-800 dark:text-blue-300">Need Help?</h3>
                <p className="text-sm mt-2 text-gray-700 dark:text-gray-300">
                  If you have any questions or need support, please contact our team.
                </p>
                <a
                  href="mailto:ehmyitayew@college.harvard.edu"
                  className="mt-3 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Contact Support
                </a>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-grow">
            <div className="prose prose-blue max-w-none dark:prose-invert">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className={`transition-all duration-300 ${
                    openSection === section.id ? 'block' : 'hidden'
                  }`}
                  id={section.id}
                >
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex items-center space-x-2 mb-6">
                      {section.icon}
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{section.title}</h2>
                    </div>
                    <div className="text-gray-700 dark:text-gray-300">
                      {section.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
