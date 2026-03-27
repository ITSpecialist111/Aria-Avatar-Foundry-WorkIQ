import { X } from 'lucide-react';
import { DEMO_SCENARIOS } from '../types';
import type { AvatarConfig, DemoScenario } from '../types';

interface DemoControlsProps {
  avatarConfig: AvatarConfig;
  onAvatarChange: (config: AvatarConfig) => void;
  onClose: () => void;
  onSelectScenario: (scenario: DemoScenario) => void;
}

const AVATAR_PRESETS = [
  { character: 'meg' as const, style: 'casual', label: 'Meg Casual' },
  { character: 'meg' as const, style: 'business', label: 'Meg Business' },
  { character: 'meg' as const, style: 'formal', label: 'Meg Formal' },
  { character: 'max' as const, style: 'business', label: 'Max Business' },
  { character: 'max' as const, style: 'casual', label: 'Max Casual' },
];

const BG_PRESETS = [
  { color: '#1e293b', label: 'Slate' },
  { color: '#0f172a', label: 'Dark Navy' },
  { color: '#172554', label: 'Brand Blue' },
  { color: '#1a1a2e', label: 'Deep Purple' },
  { color: '#0d1117', label: 'GitHub Dark' },
];

export function DemoControls({
  avatarConfig,
  onAvatarChange,
  onClose,
  onSelectScenario,
}: DemoControlsProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Demo Controls</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Avatar selection */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Avatar</h3>
          <div className="grid grid-cols-2 gap-2">
            {AVATAR_PRESETS.map((preset) => (
              <button
                key={`${preset.character}-${preset.style}`}
                onClick={() => onAvatarChange({ ...avatarConfig, character: preset.character, style: preset.style })}
                className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  avatarConfig.character === preset.character && avatarConfig.style === preset.style
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        {/* Background */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Background</h3>
          <div className="flex gap-2">
            {BG_PRESETS.map((preset) => (
              <button
                key={preset.color}
                onClick={() => onAvatarChange({ ...avatarConfig, backgroundColor: preset.color })}
                className={`w-10 h-10 rounded-lg border-2 transition-colors ${
                  avatarConfig.backgroundColor === preset.color
                    ? 'border-brand-500'
                    : 'border-slate-600 hover:border-slate-400'
                }`}
                style={{ backgroundColor: preset.color }}
                title={preset.label}
              />
            ))}
          </div>
        </section>

        {/* Scenarios */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Demo Scenarios</h3>
          <div className="space-y-2">
            {DEMO_SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => onSelectScenario(scenario)}
                className="w-full text-left px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors space-y-1"
              >
                <p className="text-sm font-medium text-white">{scenario.name}</p>
                <p className="text-xs text-slate-400">{scenario.description}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
