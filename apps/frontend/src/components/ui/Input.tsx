import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, hint, startIcon, endIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-[#202124] select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {startIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-[#6B7280]">
              {startIcon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              'h-10 w-full rounded-btn border border-[#E8EAF0] bg-white px-3 py-2 text-sm text-[#202124] placeholder:text-[#9CA3AF] focus:border-[#F07818] focus:outline-none focus:ring-1 focus:ring-[#F07818] disabled:cursor-not-allowed disabled:bg-[#F7F8FA] disabled:opacity-60 transition-colors',
              startIcon && 'pl-9',
              endIcon && 'pr-9',
              error && 'border-[#D94343] focus:border-[#D94343] focus:ring-[#D94343]',
              className
            )}
            {...props}
          />
          {endIcon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-[#6B7280]">
              {endIcon}
            </div>
          )}
        </div>
        {error && <span className="text-xs text-[#D94343] font-medium">{error}</span>}
        {hint && !error && <span className="text-xs text-[#6B7280]">{hint}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
