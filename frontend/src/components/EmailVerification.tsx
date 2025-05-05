import React from 'react';
import { AlertCircle, CheckCircle, Mail } from 'lucide-react';

interface EmailVerificationProps {
  email: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

export const EmailVerification: React.FC<EmailVerificationProps> = ({ 
  email, 
  status, 
  message = "Please check your email for a verification link" 
}) => {
  return (
    <div className="p-6 max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0">
          {status === 'pending' && (
            <Mail className="h-12 w-12 text-blue-500" />
          )}
          {status === 'success' && (
            <CheckCircle className="h-12 w-12 text-green-500" />
          )}
          {status === 'error' && (
            <AlertCircle className="h-12 w-12 text-red-500" />
          )}
        </div>
        <div>
          <div className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            {status === 'pending' && 'Email Verification Required'}
            {status === 'success' && 'Email Verified'}
            {status === 'error' && 'Verification Error'}
          </div>
          <p className="text-gray-500 dark:text-gray-300">
            {message}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            {status === 'pending' && `Verification email sent to: ${email}`}
          </p>
        </div>
      </div>
    </div>
  );
}; 