import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'indigo' | 'teal' | 'amber' | 'coral' | 'neutral';
  pulse?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'indigo',
  pulse = false,
  className = '',
}) => {
  const variantStyles = {
    indigo: 'bg-[rgba(108,124,255,0.15)] text-[#6C7CFF] border-[rgba(108,124,255,0.3)]',
    teal: 'bg-[rgba(61,217,179,0.15)] text-[#3DD9B3] border-[rgba(61,217,179,0.3)]',
    amber: 'bg-[rgba(255,181,71,0.15)] text-[#FFB547] border-[rgba(255,181,71,0.3)]',
    coral: 'bg-[rgba(255,122,122,0.15)] text-[#FF7A7A] border-[rgba(255,122,122,0.3)]',
    neutral: 'bg-[#222B42] text-[#94A3B8] border-[#2A3348]',
  };

  const dotColors = {
    indigo: 'bg-[#6C7CFF]',
    teal: 'bg-[#3DD9B3]',
    amber: 'bg-[#FFB547]',
    coral: 'bg-[#FF7A7A]',
    neutral: 'bg-[#94A3B8]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wider uppercase border ${variantStyles[variant]} ${className}`}
    >
      {pulse && (
        <span className={`w-2 h-2 rounded-full ${dotColors[variant]} animate-pulse-dot`} aria-hidden="true" />
      )}
      {children}
    </span>
  );
};
