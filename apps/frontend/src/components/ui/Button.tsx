import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-btn transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.99] cursor-pointer';

    const variants = {
      primary:
        'bg-[#F07818] text-white hover:bg-[#C85A0A] focus-visible:ring-[#F07818] shadow-sm shadow-[#F07818]/20',
      secondary:
        'bg-[#FFF0E3] text-[#C85A0A] hover:bg-[#ffe4cc] focus-visible:ring-[#F07818]',
      outline:
        'border border-[#E8EAF0] bg-white text-[#202124] hover:bg-[#F7F8FA] hover:border-[#D1D5DB] focus-visible:ring-[#F07818]',
      ghost:
        'text-[#6B7280] hover:bg-[#F7F8FA] hover:text-[#202124] focus-visible:ring-[#F07818]',
      danger:
        'bg-[#D94343] text-white hover:bg-[#b83232] focus-visible:ring-[#D94343] shadow-sm',
      success:
        'bg-[#16865B] text-white hover:bg-[#116b48] focus-visible:ring-[#16865B] shadow-sm',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2.5 font-semibold',
      icon: 'h-9 w-9 p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Processing...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
