import React, { ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onOpenChange,
  children
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
        {children}
      </div>
    </div>
  );
};

interface DialogContentProps {
  children: ReactNode;
}

export const DialogContent: React.FC<DialogContentProps> = ({ children }) => {
  return <div>{children}</div>;
};

interface DialogHeaderProps {
  children: ReactNode;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children }) => {
  return <div className="p-4 border-b border-gray-200 dark:border-gray-700">{children}</div>;
};

interface DialogTitleProps {
  children: ReactNode;
  className?: string;
}

export const DialogTitle: React.FC<DialogTitleProps> = ({ children, className }) => {
  return <h3 className={`text-lg font-semibold text-gray-900 dark:text-white ${className || ''}`}>{children}</h3>;
};

interface DialogDescriptionProps {
  children: ReactNode;
}

export const DialogDescription: React.FC<DialogDescriptionProps> = ({ children }) => {
  return <p className="text-gray-700 dark:text-gray-300 mt-2">{children}</p>;
};
