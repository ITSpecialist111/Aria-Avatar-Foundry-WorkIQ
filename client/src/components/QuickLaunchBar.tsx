import { DEMO_SCENARIOS } from '../types';

interface QuickLaunchBarProps {
  onSelect: (prompt: string) => void;
}

// Show a curated subset for quick access
const QUICK_SCENARIOS = DEMO_SCENARIOS.filter(s =>
  ['morning-briefing', 'schedule-meeting', 'email-triage', 'research-delegate'].includes(s.id)
);

export function QuickLaunchBar({ onSelect }: QuickLaunchBarProps) {
  return (
    <div className="quick-launch-bar">
      {QUICK_SCENARIOS.map(scenario => (
        <button
          key={scenario.id}
          onClick={() => onSelect(scenario.promptHint)}
          className="quick-launch-pill"
          title={scenario.description}
        >
          {scenario.name}
        </button>
      ))}
    </div>
  );
}
