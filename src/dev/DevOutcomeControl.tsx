import React, { useState } from 'react';
import { DemoOutcome, DEMO_OUTCOMES, demoOutcome, isDevBuild } from './demoOutcome';

const LABELS: Record<DemoOutcome, string> = {
  natural: 'Natural (simulated opponent)',
  win: 'Force WIN',
  loss: 'Force LOSS',
  draw: 'Force DRAW',
};

/**
 * DEVELOPMENT-ONLY: picks the demo outcome applied when the match ends.
 * Renders nothing in production builds.
 */
export const DevOutcomeControl: React.FC = () => {
  const [outcome, setOutcome] = useState<DemoOutcome>(() => demoOutcome.get());

  if (!isDevBuild) return null;

  const handleChange = (value: DemoOutcome) => {
    setOutcome(value);
    demoOutcome.set(value);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[#FFB547]/40 bg-[#FFB547]/5 text-[11px] font-mono text-[#FFB547]">
      <span className="font-bold">DEV ONLY</span>
      <label htmlFor="dev-demo-outcome" className="text-[#94A3B8]">
        Demo outcome at match end:
      </label>
      <select
        id="dev-demo-outcome"
        value={outcome}
        onChange={(e) => handleChange(e.target.value as DemoOutcome)}
        className="bg-[#1A2133] border border-[#2A3348] rounded-lg px-2 py-1 text-[#F1F5F9] focus:outline-none focus:border-[#FFB547]"
      >
        {DEMO_OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {LABELS[o]}
          </option>
        ))}
      </select>
      {outcome === 'win' && (
        <span className="text-[#94A3B8]">WIN needs a score above 0 (e.g. complete a task).</span>
      )}
    </div>
  );
};
