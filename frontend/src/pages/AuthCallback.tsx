import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { EmailVerification } from '../components/EmailVerification';

export function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('Verifying your email...');
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Get the URL hash fragment
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const error = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');
    
    if (error) {
      setStatus('error');
      setMessage(errorDescription || 'An error occurred during verification');
      return;
    }
    
    // Process the callback
    const processCallback = async () => {
      try {
        // The email confirmation happens automatically through Supabase's Auth JS library
        // We just need to check if the user is now authenticated
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (session) {
          setStatus('success');
          setMessage('Your email has been verified successfully!');
          if (session.user?.email) {
            setEmail(session.user.email);
          }
          
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            navigate('/wizard');
          }, 2000);
        } else {
          setStatus('error');
          setMessage('No session found. Please try signing in again.');
        }
      } catch (error) {
        console.error('Error processing auth callback:', error);
        setStatus('error');
        setMessage('An error occurred during verification. Please try again.');
      }
    };
    
    processCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <EmailVerification 
        email={email} 
        status={status} 
        message={message} 
      />
    </div>
  );
} 