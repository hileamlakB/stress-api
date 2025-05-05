import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { signIn, getCurrentUser, resendVerificationEmail } from '../lib/auth';
import { EmailVerification } from '../components/EmailVerification';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [emailResent, setEmailResent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const navigate = useNavigate();

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
            // User is authenticated but not verified
            setUserEmail(user.email || '');
            setVerificationRequired(true);
          }
        }
      } catch (error) {
        // Error checking authentication, continue showing login form
        console.error('Auth check error:', error);
      }
    };
    
    checkAuth();
  }, [navigate]);

  // Countdown effect for auto-redirect after resending verification
  useEffect(() => {
    if (emailResent && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (emailResent && countdown === 0) {
      navigate('/login');
    }
  }, [emailResent, countdown, navigate]);
  
  const handleResendVerification = async () => {
    if (!userEmail) return;
    
    setResendLoading(true);
    try {
      await resendVerificationEmail(userEmail);
      setEmailResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification email');
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { user } = await signIn(email, password);
      
      // Check if email is verified
      const emailVerified = user?.email_confirmed_at || user?.confirmed_at;
      
      if (emailVerified) {
        // User is verified, redirect to dashboard
        navigate('/dashboard');
      } else {
        // User is not verified, show verification required screen
        setUserEmail(user?.email || email);
        setVerificationRequired(true);
      }
    } catch (err) {
      // Check if error is about unverified email
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in';
      if (errorMessage.toLowerCase().includes('email') && 
          (errorMessage.toLowerCase().includes('confirm') || 
           errorMessage.toLowerCase().includes('verif'))) {
        // Likely an unverified email error
        setUserEmail(email);
        setVerificationRequired(true);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // If email has been resent, show confirmation screen
  if (emailResent) {
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verification Email Sent!</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              We've sent a fresh verification email to <span className="font-semibold">{userEmail}</span>.
              Please check your inbox and click the verification link to activate your account.
            </p>
            
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center text-blue-700 dark:text-blue-300">
                <Mail className="h-5 w-5 mr-2" />
                <span>Please check your spam folder if you don't see the email.</span>
              </div>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
              Redirecting to login in {countdown} seconds...
            </p>
            
            <Button 
              variant="outline" 
              onClick={() => {
                setEmailResent(false);
                setVerificationRequired(false);
              }}
              className="w-full"
            >
              Return to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If verification is required, show verification screen with resend option
  if (verificationRequired) {
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
            <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Email Verification Required</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Your account <span className="font-semibold">{userEmail}</span> requires email verification before you can log in.
            </p>
            
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="flex items-center text-amber-700 dark:text-amber-300">
                <Mail className="h-5 w-5 mr-2" />
                <span>We previously sent you a verification email. Please check your inbox and spam folder.</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <Button 
                onClick={handleResendVerification}
                className="w-full"
                disabled={resendLoading}
              >
                {resendLoading ? 'Sending...' : 'Resend Verification Email'}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => {
                  setVerificationRequired(false);
                  setError('');
                }}
                className="w-full"
              >
                Try Different Account
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center justify-center space-x-2">
            <Zap className="h-8 w-8 text-blue-500" />
            <span className="text-2xl font-semibold text-gray-900">FastAPI Stress Tester</span>
          </Link>
          <h2 className="mt-6 text-3xl font-semibold text-gray-900">Welcome back</h2>
          <p className="mt-2 text-gray-600">Sign in to your account to continue</p>
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
                <div className="mt-2 text-right">
                  <Link to="/forgot-password" className="text-sm text-blue-500 hover:text-blue-600">
                    Forgot password?
                  </Link>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>

            <div className="text-center text-sm">
              <span className="text-gray-600">Don't have an account? </span>
              <Link to="/register" className="text-blue-500 hover:text-blue-600 font-medium">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}