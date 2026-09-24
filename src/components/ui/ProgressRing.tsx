import React from 'react';

export interface ProgressRingProps {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  variant?: 'indigo' | 'teal' | 'amber';
  children?: React.ReactNode;
  className?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 240,
  strokeWidth = 10,
  variant = 'teal',
  children,
  className = '',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  const colorStyles = {
    indigo: { stroke: '#6C7CFF', glow: 'rgba(108,124,255,0.3)' },
    teal: { stroke: '#3DD9B3', glow: 'rgba(61,217,179,0.3)' },
    amber: { stroke: '#FFB547', glow: 'rgba(255,181,71,0.3)' },
  };

  const activeColor = colorStyles[variant];

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#2A3348"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Dynamic Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeColor.stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          style={{
            transition: 'stroke-dashoffset 0.5s ease-in-out',
            filter: `drop-shadow(0 0 10px ${activeColor.glow})`,
          }}
        />
      </svg>

      {/* Center Label / Timer Content */}
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          {children}
        </div>
      )}
    </div>
  );
};
