import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive' | 'activeMatch';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  onClick,
  onKeyDown,
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-4 sm:p-6',
    lg: 'p-5 sm:p-8',
  };

  // Clickable cards must be reachable and operable from the keyboard.
  const interactiveProps = onClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick,
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          onKeyDown?.(e);
          if (e.defaultPrevented || e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.currentTarget.click();
          }
        },
      }
    : { onKeyDown };

  const variantStyles = {
    default: 'bg-[#1A2133] border border-[#2A3348] rounded-2xl shadow-xl',
    elevated: 'bg-[#222B42] border border-[#36425E] rounded-2xl shadow-2xl',
    interactive: 'bg-[#1A2133] border border-[#2A3348] rounded-2xl shadow-xl transition-all duration-200 hover:border-[#6C7CFF]/50 hover:shadow-[0_0_24px_rgba(108,124,255,0.15)] cursor-pointer',
    activeMatch: 'bg-gradient-to-b from-[#1A2133] to-[#161D2D] border border-[#6C7CFF]/40 rounded-2xl shadow-[0_0_32px_rgba(108,124,255,0.15)]',
  };

  return (
    <div
      className={`${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...interactiveProps}
      {...props}
    >
      {children}
    </div>
  );
};
