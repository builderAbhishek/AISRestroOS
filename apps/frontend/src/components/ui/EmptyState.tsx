import React from 'react';
import { Button } from './Button';
import { PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center rounded-card border border-dashed border-[#E8EAF0] bg-white/60',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0E3] text-[#F07818] mb-3">
        {icon || <PackageOpen className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-[#202124]">{title}</h3>
      {description && <p className="mt-1 text-xs text-[#6B7280] max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" variant="primary" className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export const LoadingState: React.FC<{ message?: string; className?: string }> = ({
  message = 'Loading data...',
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 gap-3', className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#FFF0E3] border-t-[#F07818]" />
      <span className="text-xs font-medium text-[#6B7280]">{message}</span>
    </div>
  );
};

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}> = ({ title = 'Failed to load', message, onRetry, className }) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-card border border-[#FDECEC] bg-[#FFF8F8]',
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FDECEC] text-[#D94343] mb-2 font-bold text-lg">
        !
      </div>
      <h4 className="text-sm font-semibold text-[#202124]">{title}</h4>
      <p className="mt-1 text-xs text-[#6B7280] max-w-md">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} size="sm" variant="outline" className="mt-3">
          Try Again
        </Button>
      )}
    </div>
  );
};
