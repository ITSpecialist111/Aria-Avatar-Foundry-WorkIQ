import { useRef, useEffect } from 'react';
import { Mail, Calendar, Search, CheckSquare, MessageSquare, Globe, User, FileText, Check, X } from 'lucide-react';
import type { TranscriptEntry, AgentAction, DashboardCard } from '../types';
import type { WorkflowStep } from '../hooks/useVoiceLive';
import { DashboardPanel } from './DashboardPanel';

interface ConversationPanelProps {
  transcript: TranscriptEntry[];
  actions: AgentAction[];
  dashboardCards: DashboardCard[];
  workflowSteps: WorkflowStep[];
  onConfirmAction: (actionId: string) => void;
  onRejectAction: (actionId: string) => void;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  meeting: Calendar,
  search: Search,
  task: CheckSquare,
  chat: MessageSquare,
  web_search: Globe,
  user_lookup: User,
  file: FileText,
};

function ActionCard({ action, onConfirm, onReject }: {
  action: AgentAction;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const Icon = ACTION_ICONS[action.type] || Search;
  const statusColors: Record<string, string> = {
    pending: 'text-amber-400',
    confirmed: 'text-brand-400',
    executing: 'text-brand-400 animate-pulse',
    completed: 'text-emerald-400',
    failed: 'text-red-400',
  };

  return (
    <div className="action-card space-y-2">
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 ${statusColors[action.status] || 'text-slate-400'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">{action.summary}</p>
          <p className={`text-xs mt-1 ${statusColors[action.status] || 'text-slate-500'}`}>
            {action.status.charAt(0).toUpperCase() + action.status.slice(1)}
          </p>
        </div>
      </div>
      {action.requiresConfirmation && action.status === 'pending' && (
        <div className="flex gap-2 ml-8">
          <button
            onClick={onConfirm}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            <Check className="w-3 h-3" /> Approve
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <X className="w-3 h-3" /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

export function ConversationPanel({
  transcript,
  actions,
  dashboardCards,
  workflowSteps,
  onConfirmAction,
  onRejectAction,
}: ConversationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, actions]);

  return (
    <div className="flex flex-col h-full min-h-0" role="complementary" aria-label="Conversation panel">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Conversation
        </h3>
      </div>

      {/* Dashboard activity cards */}
      <DashboardPanel cards={dashboardCards} />

      {/* Active workflow progress indicator */}
      {workflowSteps.length > 0 && (
        <div className="px-4 py-2 bg-orange-500/10 border-b border-orange-500/20">
          <div className="flex items-center gap-2 text-xs text-orange-300">
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
            <span>Workflow: {workflowSteps.filter(s => s.status === 'completed').length}/{workflowSteps.length} steps</span>
          </div>
          <div className="mt-1 space-y-0.5">
            {workflowSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={step.status === 'completed' ? 'text-green-400' : step.status === 'failed' ? 'text-red-400' : 'text-orange-300 animate-pulse'}>
                  {step.status === 'completed' ? '\u2713' : step.status === 'failed' ? '\u2717' : '\u25CB'}
                </span>
                <span className="text-slate-400">{step.toolName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-label="Conversation messages" aria-live="polite">
        {transcript.length === 0 && actions.length === 0 && (
          <div className="text-center text-slate-500 mt-12">
            <p className="text-sm">Start a conversation with Aria</p>
            <p className="text-xs mt-1">Try: "What does my day look like?"</p>
          </div>
        )}

        {/* Interleave transcript and actions by timestamp */}
        {[...transcript.map(t => ({ ...t, _kind: 'transcript' as const })),
          ...actions.map(a => ({ ...a, _kind: 'action' as const }))]
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
          .map((item) => {
            if (item._kind === 'transcript') {
              const entry = item as TranscriptEntry & { _kind: 'transcript' };
              if (entry.role === 'system') return null;
              return (
                <div key={entry.id} className="flex">
                  <div className={`transcript-bubble ${entry.role}`}>
                    {entry.content}
                    {entry.isInterim && (
                      <span className="text-xs opacity-50 ml-2">...</span>
                    )}
                  </div>
                </div>
              );
            } else {
              const action = item as AgentAction & { _kind: 'action' };
              return (
                <ActionCard
                  key={action.id}
                  action={action}
                  onConfirm={() => onConfirmAction(action.id)}
                  onReject={() => onRejectAction(action.id)}
                />
              );
            }
          })}
      </div>
    </div>
  );
}
