import React from 'react';

export interface ProgressRingProps {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  variant?: 'indigo' | 'teal' | 'amber';
  /** Fill the ring with rising water that tracks `progress`. */
  water?: boolean;
  /** Waves drift only while true (e.g. while the timer is running). */
  waterAnimated?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 240,
  strokeWidth = 10,
  variant = 'teal',
  water = false,
  waterAnimated = true,
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

  const level = Math.min(100, Math.max(0, progress));
  const wavePath = 'M0 15 Q 25 0 50 15 T 100 15 T 150 15 T 200 15 V30 H0 Z';
  const waveStyle = (seconds: number): React.CSSProperties => ({
    animation: `waterWave ${seconds}s linear infinite`,
    animationPlayState: waterAnimated ? 'running' : 'paused',
  });

  const activeColor = colorStyles[variant];

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Rising water, clipped to the circle inside the ring */}
      {water && (
        <div
          aria-hidden="true"
          className="absolute rounded-full overflow-hidden bg-[#141B2B]"
          style={{ inset: strokeWidth + 4 }}
        >
          {level > 0 && (
            <div
              className="absolute left-0 right-0 bottom-0"
              style={{ height: `${level}%`, transition: 'height 1s linear' }}
            >
              <div className="absolute inset-x-0 top-4 bottom-0" style={{ background: activeColor.stroke, opacity: 0.28 }} />
              {[
                { seconds: 6, opacity: 0.35, offset: 0 },
                { seconds: 9, opacity: 0.25, offset: -5 },
              ].map((layer) => (
                <svg
                  key={layer.seconds}
                  viewBox="0 0 200 30"
                  preserveAspectRatio="none"
                  className="absolute left-0 top-0"
                  style={{ width: '200%', height: 18, marginTop: layer.offset, ...waveStyle(layer.seconds) }}
                >
                  <path d={wavePath} fill={activeColor.stroke} fillOpacity={layer.opacity} />
                </svg>
              ))}
            </div>
          )}
        </div>
      )}

      <svg width={size} height={size} className="relative transform -rotate-90">
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
