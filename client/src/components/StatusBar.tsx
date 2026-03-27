import { Settings } from 'lucide-react';
import type { SessionState } from '../types';

interface StatusBarProps {
  sessionState: SessionState;
  agentName: string;
  onToggleControls: () => void;
}

const STATE_LABELS: Record<SessionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  connected: 'Connected',
  active: 'Active',
  error: 'Error',
};

export function StatusBar({ sessionState, agentName, onToggleControls }: StatusBarProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
          {agentName}
        </h1>
        <span className="text-xs text-slate-500">Executive Assistant</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`status-dot ${sessionState === 'error' ? 'error' : sessionState}`} />
          <span className="text-xs text-slate-400">{STATE_LABELS[sessionState]}</span>
        </div>

        <button
          onClick={onToggleControls}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
          title="Demo Controls"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
