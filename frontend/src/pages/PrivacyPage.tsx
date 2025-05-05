import { Link } from 'react-router-dom';
import { Zap, Shield } from 'lucide-react';
import { Footer } from '../components/Footer';
import { HeaderThemeToggle } from '../components/HeaderThemeToggle';
import { Button } from '../components/Button';

export function PrivacyPage() {
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
            <Shield className="h-8 w-8 text-blue-500 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
          </div>
          
          <div className="prose prose-lg max-w-none dark:prose-invert text-gray-700 dark:text-gray-300">
            <p className="lead text-lg">Last updated: May 5, 2025</p>
            
            <p>
              At FastAPI Stress Tester, we take your privacy seriously. This Privacy Policy explains how we collect, use, 
              disclose, and safeguard your information when you use our service.
            </p>
            
            <h2>Information We Collect</h2>
            <p>
              We collect information that you provide directly to us when you:
            </p>
            <ul>
              <li>Create an account</li>
              <li>Use our stress testing services</li>
              <li>Contact our support team</li>
              <li>Subscribe to our newsletter</li>
            </ul>
            
            <p>
              This information may include:
            </p>
            <ul>
              <li>Contact information (such as name and email address)</li>
              <li>Log-in credentials</li>
              <li>API configuration details and test results</li>
              <li>Usage data and analytics</li>
            </ul>
            
            <h2>How We Use Your Information</h2>
            <p>
              We use the information we collect for various purposes, including:
            </p>
            <ul>
              <li>Providing and maintaining our service</li>
              <li>Improving and personalizing your experience</li>
              <li>Communicating with you about your account and our services</li>
              <li>Analyzing usage patterns to enhance our platform</li>
              <li>Preventing fraud and ensuring the security of our service</li>
            </ul>
            
            <h2>Data Storage and Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information 
              against unauthorized access, alteration, disclosure, or destruction. Your data is stored securely 
              on our servers and is only accessible to authorized personnel.
            </p>
            
            <h2>Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to fulfill the purposes outlined in 
              this Privacy Policy, unless a longer retention period is required or permitted by law. When we no 
              longer need your information, we will securely delete or anonymize it.
            </p>
            
            <h2>User API Data</h2>
            <p>
              When you use our stress testing service, you may provide us with information about your API, including URLs, 
              endpoints, authentication details, and request payloads. We use this information solely for the purpose of 
              performing the requested stress tests and providing you with the results.
            </p>
            <p>
              We do not:
            </p>
            <ul>
              <li>Share your API data with third parties</li>
              <li>Use your API data for any purpose other than providing our service</li>
              <li>Retain API credentials longer than necessary to perform the requested tests</li>
            </ul>
            
            <h2>Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar tracking technologies to track activity on our service and hold certain information. 
              You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you 
              do not accept cookies, you may not be able to use some portions of our service.
            </p>
            <p>
              For more information about our use of cookies, please see our <Link to="/cookies" className="text-blue-600 dark:text-blue-400 hover:underline">Cookie Policy</Link>.
            </p>
            
            <h2>Third-Party Services</h2>
            <p>
              We may use third-party services, such as analytics providers and payment processors, that collect, 
              monitor, and analyze information to help us improve our service. These third parties have their own 
              privacy policies addressing how they use such information.
            </p>
            
            <h2>Your Rights</h2>
            <p>
              Depending on your location, you may have certain rights regarding your personal information, including:
            </p>
            <ul>
              <li>The right to access your personal information</li>
              <li>The right to correct inaccurate or incomplete information</li>
              <li>The right to delete your personal information</li>
              <li>The right to restrict or object to the processing of your personal information</li>
              <li>The right to data portability</li>
              <li>The right to withdraw consent at any time</li>
            </ul>
            <p>
              To exercise these rights, please contact us at <a href="mailto:ehmyitayew@college.harvard.edu" className="text-blue-600 dark:text-blue-400 hover:underline">ehmyitayew@college.harvard.edu</a>.
            </p>
            
            <h2>Children's Privacy</h2>
            <p>
              Our service is not intended for use by children under the age of 13. We do not knowingly collect 
              personal information from children under 13. If you are a parent or guardian and you are aware 
              that your child has provided us with personal information, please contact us.
            </p>
            
            <h2>Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting 
              the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review 
              this Privacy Policy periodically for any changes.
            </p>
            
            <h2>Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:
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
