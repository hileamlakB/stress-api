import React from 'react';
import { AlertTriangle, X, AlertCircle, Info } from 'lucide-react';
import { Button } from './Button';

// Define dialog types
export type DialogType = 'warning' | 'error' | 'info' | 'confirmation';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger' | 'outline';
  dialogType?: DialogType;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  dialogType = 'confirmation',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  // Map variant to button classes
  const confirmButtonClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    outline: 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-300',
  }[confirmVariant];

  // Get the appropriate icon based on dialog type
  const getDialogIcon = () => {
    switch (dialogType) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500 mr-2" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500 mr-2" />;
      case 'confirmation':
        return confirmVariant === 'danger' ? <AlertTriangle className="h-5 w-5 text-red-500 mr-2" /> : null;
      default:
        return null;
    }
  };

  // Only show the cancel button for confirmation dialogs
  const showCancelButton = dialogType === 'confirmation';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            {getDialogIcon()}
            {title}
          </h3>
          <button 
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            {message}
          </p>
          
          <div className="flex justify-end space-x-3">
            {showCancelButton && (
              <Button 
                variant="outline" 
                onClick={onCancel}
                size="sm"
              >
                {cancelLabel}
              </Button>
            )}
            <Button 
              className={confirmButtonClasses}
              onClick={onConfirm}
              size="sm"
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}; 