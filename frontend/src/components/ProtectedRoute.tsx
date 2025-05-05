import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '../lib/auth';
import { EmailVerification } from './EmailVerification';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(true);
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
          setIsVerified(!!emailVerified);
          setIsAuthenticated(true);
        } else {
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

  return <>{children}</>;
}; 