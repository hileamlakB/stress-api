import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Zap, Mail, CheckCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { signUp, getCurrentUser, signOut } from '../lib/auth';
import { EmailVerification } from '../components/EmailVerification';

export function RegisterPage() {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const navigate = useNavigate();

  // Check if we should show the verification screen directly
  // This is useful for debugging
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const testEmail = params.get('email');
    const testMode = params.get('test');
    
    if (testMode === 'verify' && testEmail) {
      setEmail(testEmail);
      setVerificationRequired(true);
      setRegistrationSuccess(true);
    }
  }, [location]);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          // Check if email is verified
          const emailVerified = user.email_confirmed_at || user.confirmed_at;
          
          if (emailVerified) {
            // User is authenticated and verified, redirect to dashboard
            navigate('/dashboard');
          } else {
            // User is authenticated but not verified, show verification screen
            setEmail(user.email || '');
            setVerificationRequired(true);
          }
        }
      } catch (error) {
        // Error checking authentication, continue showing registration form
        console.error('Auth check error:', error);
      }
    };
    
    checkAuth();
  }, [navigate]);

  // Debugging state changes
  useEffect(() => {
    console.log("State changed - verificationRequired:", verificationRequired);
    console.log("State changed - registrationSuccess:", registrationSuccess);
  }, [verificationRequired, registrationSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      console.log("Submitting registration form");
      const response = await signUp(email, password);
      console.log("Registration response:", response);
      
      // Check if email verification is needed
      if (response && response.needsEmailVerification) {
        console.log('Email verification required, signing out user');
        // Sign out the user so they must verify before accessing the app
        await signOut();
        
        // Important: Set these states and then return immediately to prevent any navigation
        setVerificationRequired(true);
        setRegistrationSuccess(true);
        setLoading(false);
        return; // IMPORTANT: Return here to ensure no further code runs
      } else {
        // If no verification needed, redirect to dashboard
        console.log("No verification needed, redirecting to dashboard");
        navigate('/dashboard');
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  // If registration is successful, show confirmation screen with countdown
  if (registrationSuccess) {
    console.log("Rendering registration success screen");
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Link to="/" className="inline-flex items-center justify-center space-x-2">
              <Zap className="h-8 w-8 text-blue-500" />
              <span className="text-2xl font-semibold text-gray-900">FastAPI Stress Tester</span>
            </Link>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account Created!</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              We've sent a verification email to <span className="font-semibold">{email}</span>.
              Please check your inbox and click the verification link to activate your account.
            </p>
            
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center text-blue-700 dark:text-blue-300">
                <Mail className="h-5 w-5 mr-2" />
                <span>Please check your spam folder if you don't see the email.</span>
              </div>
            </div>
            
            <Button 
              onClick={() => navigate('/login')}
              className="w-full"
            >
              Continue to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If verification is required but not showing success screen, show verification instructions
  if (verificationRequired && !registrationSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Link to="/" className="inline-flex items-center justify-center space-x-2">
              <Zap className="h-8 w-8 text-blue-500" />
              <span className="text-2xl font-semibold text-gray-900">FastAPI Stress Tester</span>
            </Link>
          </div>
          
          <EmailVerification 
            email={email} 
            status="pending" 
            message="Please check your email and verify your account before continuing." 
          />
          
          <div className="text-center mt-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/login')}
              className="mt-4"
            >
              Return to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Normal registration form
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center justify-center space-x-2">
            <Zap className="h-8 w-8 text-blue-500" />
            <span className="text-2xl font-semibold text-gray-900">FastAPI Stress Tester</span>
          </Link>
          <h2 className="mt-6 text-3xl font-semibold text-gray-900">Create your account</h2>
          <p className="mt-2 text-gray-600">Start testing your FastAPI applications today</p>
        </div>
        
        <div className="apple-card p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl p-4 text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="apple-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="apple-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  className="apple-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>

            <div className="text-center text-sm">
              <span className="text-gray-600">Already have an account? </span>
              <Link to="/login" className="text-blue-500 hover:text-blue-600 font-medium">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}