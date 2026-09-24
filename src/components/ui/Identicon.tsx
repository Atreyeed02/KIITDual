import React from 'react';
import { getIdenticonConfig } from '../../utils/identicon';

interface IdenticonProps {
  seed: string;
  size?: number;
  className?: string;
  hasGlow?: boolean;
}

export const Identicon: React.FC<IdenticonProps> = ({
  seed,
  size = 48,
  className = '',
  hasGlow = false,
}) => {
  const config = getIdenticonConfig(seed);
  const { palette, shapeType, rotation } = config;
  const gradientId = `identicon-grad-${seed.replace(/[^a-zA-Z0-9]/g, '')}`;
  const filterId = `identicon-glow-${seed.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="rounded-full overflow-hidden"
        style={{
          boxShadow: hasGlow ? `0 0 16px ${palette.primary}40` : undefined,
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.bg1} />
            <stop offset="100%" stopColor={palette.bg2} />
          </linearGradient>
          {hasGlow && (
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          )}
        </defs>

        {/* Base Circle */}
        <circle cx="50" cy="50" r="50" fill={`url(#${gradientId})`} />
        <circle cx="50" cy="50" r="49" stroke="#2A3348" strokeWidth="2" />

        {/* Geometric Shapes based on shapeType */}
        <g transform={`rotate(${rotation} 50 50)`}>
          {shapeType === 'concentric' && (
            <>
              <circle cx="50" cy="50" r="32" stroke={palette.primary} strokeWidth="3" opacity="0.4" />
              <circle cx="50" cy="50" r="22" stroke={palette.secondary} strokeWidth="4" />
              <rect x="42" y="42" width="16" height="16" rx="4" fill={palette.primary} />
            </>
          )}

          {shapeType === 'diamonds' && (
            <>
              <rect x="25" y="25" width="50" height="50" rx="8" fill={palette.primary} opacity="0.25" transform="rotate(45 50 50)" />
              <rect x="35" y="35" width="30" height="30" rx="6" stroke={palette.secondary} strokeWidth="3" transform="rotate(45 50 50)" />
              <circle cx="50" cy="50" r="8" fill={palette.primary} />
            </>
          )}

          {shapeType === 'polygrid' && (
            <>
              <polygon points="50,18 80,72 20,72" fill={palette.primary} opacity="0.3" />
              <polygon points="50,82 20,28 80,28" stroke={palette.secondary} strokeWidth="3" fill="none" />
              <circle cx="50" cy="50" r="10" fill={palette.primary} />
            </>
          )}

          {shapeType === 'orbit' && (
            <>
              <ellipse cx="50" cy="50" rx="36" ry="16" stroke={palette.primary} strokeWidth="3" opacity="0.6" />
              <ellipse cx="50" cy="50" rx="16" ry="36" stroke={palette.secondary} strokeWidth="3" opacity="0.8" />
              <circle cx="50" cy="50" r="12" fill={palette.primary} />
            </>
          )}
        </g>
      </svg>
    </div>
  );
};
