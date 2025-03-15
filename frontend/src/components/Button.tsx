import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-200',
          {
            'apple-button-primary': variant === 'primary',
            'apple-button-secondary': variant === 'secondary',
            'apple-button-outline': variant === 'outline',
            'text-sm h-9 px-4 rounded-lg': size === 'sm',
            'h-12 px-6 rounded-xl': size === 'md',
            'h-14 px-8 rounded-xl text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };