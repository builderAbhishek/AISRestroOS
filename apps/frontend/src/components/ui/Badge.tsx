import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'bhagwa' | 'success' | 'warning' | 'danger' | 'neutral' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'neutral',
  size = 'md',
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-medium select-none rounded-full whitespace-nowrap';

  const variants = {
    bhagwa: 'bg-[#FFF0E3] text-[#C85A0A] border border-[#F07818]/30',
    success: 'bg-[#EBF7F2] text-[#16865B] border border-[#16865B]/20',
    warning: 'bg-[#FEF6EB] text-[#D98A16] border border-[#D98A16]/20',
    danger: 'bg-[#FDECEC] text-[#D94343] border border-[#D94343]/20',
    neutral: 'bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]',
    outline: 'border border-[#E8EAF0] text-[#6B7280]',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
};
