import { Link } from 'react-router-dom';
import { Zap, FileText } from 'lucide-react';
import { Footer } from '../components/Footer';
import { HeaderThemeToggle } from '../components/HeaderThemeToggle';
import { Button } from '../components/Button';

export function TermsPage() {
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
            <FileText className="h-8 w-8 text-blue-500 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Terms of Service</h1>
          </div>
          
          <div className="prose prose-lg max-w-none dark:prose-invert text-gray-700 dark:text-gray-300">
            <p className="lead text-lg">Last updated: May 5, 2025</p>
            
            <p>
              Please read these Terms of Service ("Terms") carefully before using the FastAPI Stress Tester service.
            </p>
            
            <h2>1. Agreement to Terms</h2>
            <p>
              By accessing or using our service, you agree to be bound by these Terms. If you disagree with any part of the terms, 
              you may not access the service.
            </p>
            
            <h2>2. Description of Service</h2>
            <p>
              FastAPI Stress Tester provides load testing tools for FastAPI applications. Our service allows users to 
              simulate traffic to their APIs, measure performance, and identify bottlenecks.
            </p>
            
            <h2>3. User Accounts</h2>
            <p>
              When you create an account with us, you must provide accurate, complete, and current information. You are responsible 
              for safeguarding the password and for all activities that occur under your account.
            </p>
            <p>
              You agree not to share your account credentials with any third party. You must notify us immediately upon becoming 
              aware of any breach of security or unauthorized use of your account.
            </p>
            
            <h2>4. Acceptable Use Policy</h2>
            <p>
              You agree not to use FastAPI Stress Tester for any purpose that is illegal or prohibited by these Terms. 
              Specifically, you agree not to:
            </p>
            <ul>
              <li>Use our service to conduct stress tests against systems that you do not own or have explicit permission to test</li>
              <li>Attempt to bypass any rate limiting or security measures</li>
              <li>Use our service to distribute malware or conduct malicious activities</li>
              <li>Interfere with or disrupt the service or servers or networks connected to the service</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>
            
            <h2>5. API Usage</h2>
            <p>
              When using our service to test your APIs, you are responsible for ensuring that you have the right to conduct 
              such tests. FastAPI Stress Tester is not responsible for any damages or disruptions that may occur to your 
              systems as a result of using our service.
            </p>
            
            <h2>6. Intellectual Property</h2>
            <p>
              The service and its original content, features, and functionality are and will remain the exclusive property of 
              FastAPI Stress Tester and its licensors. The service is protected by copyright, trademark, and other laws.
            </p>
            <p>
              Our trademarks and trade dress may not be used in connection with any product or service without the prior 
              written consent of FastAPI Stress Tester.
            </p>
            
            <h2>7. User Content</h2>
            <p>
              When you provide data for stress testing, you retain all rights to your content. By uploading content to our service, 
              you grant us a worldwide, non-exclusive, royalty-free license to use, store, and process that content solely for 
              the purpose of providing our service to you.
            </p>
            
            <h2>8. Termination</h2>
            <p>
              We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including 
              without limitation if you breach the Terms.
            </p>
            <p>
              Upon termination, your right to use the service will immediately cease. If you wish to terminate your account, 
              you may simply discontinue using the service or contact us to request account deletion.
            </p>
            
            <h2>9. Limitation of Liability</h2>
            <p>
              In no event shall FastAPI Stress Tester, nor its directors, employees, partners, agents, suppliers, or affiliates, 
              be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, 
              loss of profits, data, use, goodwill, or other intangible losses, resulting from:
            </p>
            <ul>
              <li>Your use or inability to use the service</li>
              <li>Any conduct or content of any third party on the service</li>
              <li>Any content obtained from the service</li>
              <li>Unauthorized access, use, or alteration of your transmissions or content</li>
            </ul>
            
            <h2>10. Disclaimer</h2>
            <p>
              Your use of the service is at your sole risk. The service is provided on an "AS IS" and "AS AVAILABLE" basis. 
              The service is provided without warranties of any kind, whether express or implied.
            </p>
            
            <h2>11. Governing Law</h2>
            <p>
              These Terms shall be governed and construed in accordance with the laws of the United States, without regard 
              to its conflict of law provisions.
            </p>
            
            <h2>12. Changes to Terms</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. By continuing to access 
              or use our service after those revisions become effective, you agree to be bound by the revised terms.
            </p>
            
            <h2>13. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
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
