import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'teal' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  className = '',
  disabled,
  type = 'button',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0F1420] disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5',
    md: 'text-sm px-5 py-2.5 gap-2',
    lg: 'text-base px-7 py-3.5 gap-2.5 font-semibold',
  };

  const variantStyles = {
    primary: 'bg-[#6C7CFF] text-[#F1F5F9] hover:bg-[#7E8EFF] hover:shadow-[0_0_20px_rgba(108,124,255,0.4)] focus:ring-[#6C7CFF]',
    secondary: 'bg-transparent text-[#F1F5F9] border border-[#2A3348] hover:bg-[#222B42] hover:border-[#36425E] focus:ring-[#6C7CFF]',
    teal: 'bg-[#3DD9B3] text-[#0F1420] hover:bg-[#50EBC4] hover:shadow-[0_0_20px_rgba(61,217,179,0.4)] font-semibold focus:ring-[#3DD9B3]',
    ghost: 'bg-transparent text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#222B42] focus:ring-[#6C7CFF]',
    destructive: 'bg-[rgba(255,122,122,0.1)] text-[#FF7A7A] border border-[rgba(255,122,122,0.2)] hover:bg-[rgba(255,122,122,0.2)] focus:ring-[#FF7A7A]',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      type={type}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
};
