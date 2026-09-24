import React from 'react';

export interface LoadingIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  variant?: 'indigo' | 'teal' | 'amber';
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  size = 'md',
  label,
  variant = 'indigo',
}) => {
  const sizeStyles = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  const colorStyles = {
    indigo: 'border-[#6C7CFF]/30 border-t-[#6C7CFF]',
    teal: 'border-[#3DD9B3]/30 border-t-[#3DD9B3]',
    amber: 'border-[#FFB547]/30 border-t-[#FFB547]',
  };

  return (
    <div className="inline-flex flex-col items-center justify-center gap-3">
      <div
        className={`rounded-full animate-spin ${sizeStyles[size]} ${colorStyles[variant]}`}
      />
      {label && <p className="text-sm font-medium text-[#94A3B8]">{label}</p>}
    </div>
  );
};
