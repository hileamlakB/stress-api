import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '../lib/auth';
import { EmailVerification } from './EmailVerification';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false); // Default to false for safety
  const [userEmail, setUserEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        
        if (user) {
          // Set user email for verification display
          setUserEmail(user.email || '');
          
          // Check if user has email verification
          const emailVerified = user.email_confirmed_at || user.confirmed_at;
          console.log('User:', user);
          console.log('Email verification status:', !!emailVerified);
          console.log('email_confirmed_at:', user.email_confirmed_at);
          console.log('confirmed_at:', user.confirmed_at);
          
          setIsVerified(!!emailVerified);
          setIsAuthenticated(true);
        } else {
          console.log('No user found');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Always log the current state when it changes
  useEffect(() => {
    console.log('Protected Route State:', {
      isAuthenticated,
      isVerified,
      userEmail,
      isLoading
    });
  }, [isAuthenticated, isVerified, userEmail, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // If authenticated but email not verified, show verification screen
  if (!isVerified) {
    console.log('User is not verified, showing verification screen');
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <EmailVerification 
          email={userEmail} 
          status="pending" 
          message="Please check your email and verify your account before continuing." 
        />
      </div>
    );
  }

  console.log('User is authenticated and verified, showing protected content');
  return <>{children}</>;
}; 