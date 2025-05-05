import { Link } from 'react-router-dom';
import { Zap, Cookie } from 'lucide-react';
import { Footer } from '../components/Footer';
import { HeaderThemeToggle } from '../components/HeaderThemeToggle';
import { Button } from '../components/Button';

export function CookiesPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Header/Navigation */}
      <nav className="bg-gradient-to-b from-gray-900 to-gray-800 border-b border-gray-700 text-white">
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

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12 flex-grow">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center mb-8">
            <Cookie className="h-8 w-8 text-blue-500 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cookie Policy</h1>
          </div>
          
          <div className="prose prose-lg max-w-none dark:prose-invert text-gray-700 dark:text-gray-300">
            <p className="lead text-lg">Last updated: May 5, 2025</p>
            
            <p>
              This Cookie Policy explains how FastAPI Stress Tester uses cookies and similar technologies 
              to recognize you when you visit our website. It explains what these technologies are and why 
              we use them, as well as your rights to control our use of them.
            </p>
            
            <h2>What Are Cookies?</h2>
            <p>
              Cookies are small data files that are placed on your computer or mobile device when you visit a website. 
              Cookies are widely used by website owners to make their websites work, or to work more efficiently, 
              as well as to provide reporting information.
            </p>
            <p>
              Cookies set by the website owner (in this case, FastAPI Stress Tester) are called "first-party cookies." 
              Cookies set by parties other than the website owner are called "third-party cookies." Third-party cookies 
              enable third-party features or functionality to be provided on or through the website (e.g., advertising, 
              interactive content, and analytics).
            </p>
            
            <h2>Why Do We Use Cookies?</h2>
            <p>
              We use first-party and third-party cookies for several reasons. Some cookies are required for technical 
              reasons for our website to operate, and we refer to these as "essential" or "necessary" cookies. 
              Other cookies enable us to track and target the interests of our users to enhance the experience on our website. 
              Third parties serve cookies through our website for analytics and other purposes.
            </p>
            
            <h2>Types of Cookies We Use</h2>
            
            <h3>Essential Cookies</h3>
            <p>
              These cookies are strictly necessary to provide you with services available through our website and to use 
              some of its features, such as access to secure areas. Because these cookies are strictly necessary to deliver 
              the website, you cannot refuse them without impacting how our website functions.
            </p>
            
            <h3>Performance and Functionality Cookies</h3>
            <p>
              These cookies are used to enhance the performance and functionality of our website but are non-essential to 
              their use. However, without these cookies, certain functionality may become unavailable.
            </p>
            
            <h3>Analytics and Customization Cookies</h3>
            <p>
              These cookies collect information that is used either in aggregate form to help us understand how our website 
              is being used or how effective our marketing campaigns are, or to help us customize our website for you.
            </p>
            
            <h2>Specific Cookies We Use</h2>
            <table className="w-full border-collapse mb-6">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Cookie Name</th>
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Purpose</th>
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">session</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Maintains your authentication state</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Session</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">theme</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Stores your preferred color theme (light/dark)</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">1 year</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">sb-{`<uuid>`}</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Supabase authentication token</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Session</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">_ga, _gid</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Google Analytics cookies used to distinguish users</td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">2 years, 24 hours</td>
                </tr>
              </tbody>
            </table>
            
            <h2>How to Control Cookies</h2>
            <p>
              You can set or amend your web browser controls to accept or refuse cookies. If you choose to reject cookies, 
              you may still use our website though your access to some functionality and areas of our website may be restricted.
            </p>
            <p>
              Most web browsers allow some control of most cookies through the browser settings. To find out more about cookies, 
              including how to see what cookies have been set, visit <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">www.allaboutcookies.org</a>.
            </p>
            
            <h3>Browser-Specific Instructions</h3>
            <ul>
              <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
              <li><strong>Safari:</strong> Preferences → Privacy → Cookies and website data</li>
              <li><strong>Firefox:</strong> Options → Privacy & Security → Cookies and Site Data</li>
              <li><strong>Edge:</strong> Settings → Cookies and site permissions → Cookies and site data</li>
            </ul>
            
            <h2>Updates to This Cookie Policy</h2>
            <p>
              We may update this Cookie Policy from time to time to reflect changes in technology, law, our business operations, 
              or any other reason we may deem necessary or appropriate. We will notify you of any changes by posting the new 
              Cookie Policy on this page and updating the "Last updated" date.
            </p>
            
            <h2>Contact Us</h2>
            <p>
              If you have any questions about our use of cookies or this Cookie Policy, please contact us at:
              <br />
              <a href="mailto:ehmyitayew@college.harvard.edu" className="text-blue-600 dark:text-blue-400 hover:underline">ehmyitayew@college.harvard.edu</a>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
