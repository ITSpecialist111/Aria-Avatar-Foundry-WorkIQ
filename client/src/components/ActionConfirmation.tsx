import { Check, X, AlertCircle } from 'lucide-react';
import type { AgentAction } from '../types';

interface ActionConfirmationProps {
  action: AgentAction;
  onConfirm: () => void;
  onReject: () => void;
}

export function ActionConfirmation({ action, onConfirm, onReject }: ActionConfirmationProps) {
  return (
    <div className="glass-panel p-4 space-y-3 border-brand-500/30">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-brand-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-white">Confirm Action</p>
          <p className="text-sm text-slate-300 mt-1">{action.summary}</p>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onReject}
          className="flex items-center gap-1 px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" /> Reject
        </button>
        <button
          onClick={onConfirm}
          className="flex items-center gap-1 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
        >
          <Check className="w-4 h-4" /> Approve
        </button>
      </div>
    </div>
  );
}
