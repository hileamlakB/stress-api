import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Check } from 'lucide-react';
import { Button } from '../components/Button';
import { updatePassword } from '../lib/auth';

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Ensure we're in a password reset flow
  useEffect(() => {
    const hash = window.location.hash;
    // Supabase auth redirects with #access_token and #type=recovery
    const isResetFlow = hash.includes('type=recovery');
    
    if (!isResetFlow) {
      // If not coming from a password reset link, redirect to login
      navigate('/login');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      await updatePassword(password);
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center justify-center space-x-2">
            <Zap className="h-8 w-8 text-blue-500" />
            <span className="text-2xl font-semibold text-gray-900">FastAPI Stress Tester</span>
          </Link>
          <h2 className="mt-6 text-3xl font-semibold text-gray-900">
            {success ? 'Password Updated' : 'Create New Password'}
          </h2>
          <p className="mt-2 text-gray-600">
            {success 
              ? 'Your password has been reset successfully'
              : 'Enter a new password for your account'}
          </p>
        </div>
        
        <div className="apple-card p-8">
          {success ? (
            <div className="text-center space-y-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Password Reset Complete</h3>
              <p className="text-sm text-gray-600">
                Your password has been updated successfully.
              </p>
              <p className="text-xs text-gray-500">
                You will be redirected to the login page in a few seconds.
              </p>
              <div className="pt-4">
                <Link to="/login">
                  <Button className="w-full">
                    Go to Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl p-4 text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="apple-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a new password"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Password must be at least 8 characters long
                </p>
              </div>
              
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  required
                  className="apple-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Updating...' : 'Reset Password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
} 