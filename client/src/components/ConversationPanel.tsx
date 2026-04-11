import { useRef, useEffect, useState, useCallback } from 'react';
import { Mail, Calendar, Search, CheckSquare, MessageSquare, Globe, User, FileText, Check, X, Send, MessageCircle, Activity } from 'lucide-react';
import type { TranscriptEntry, AgentAction, DashboardCard, SessionState } from '../types';
import type { WorkflowStep } from '../hooks/useVoiceLive';
import { DashboardPanel } from './DashboardPanel';

interface ConversationPanelProps {
  transcript: TranscriptEntry[];
  actions: AgentAction[];
  dashboardCards: DashboardCard[];
  workflowSteps: WorkflowStep[];
  sessionState: SessionState;
  onConfirmAction: (actionId: string) => void;
  onRejectAction: (actionId: string) => void;
  onSendText: (text: string) => void;
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

const PROMPT_CHIPS = [
  "What's on my calendar today?",
  "Give me a morning briefing",
  "Show my recent emails",
  "Schedule a meeting",
];

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
  sessionState,
  onConfirmAction,
  onRejectAction,
  onSendText,
}: ConversationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'activity'>('chat');
  const [inputText, setInputText] = useState('');

  const isActive = sessionState === 'connected' || sessionState === 'active';

  useEffect(() => {
    if (scrollRef.current && activeTab === 'chat') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, actions, activeTab]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || !isActive) return;
    onSendText(text);
    setInputText('');
  }, [inputText, isActive, onSendText]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="flex flex-col h-full min-h-0 glass-surface rounded-none border-0 border-l border-white/[0.06]"
         role="complementary" aria-label="Conversation panel">
      {/* Tabs */}
      <div className="relative flex border-b border-white/[0.06] shrink-0">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
            activeTab === 'chat' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Chat
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
            activeTab === 'activity' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Activity
          {dashboardCards.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-brand-600/30 text-brand-300 rounded-full">
              {dashboardCards.length}
            </span>
          )}
        </button>
        {/* Animated tab indicator */}
        <div
          className="tab-indicator"
          style={{
            width: '50%',
            transform: activeTab === 'chat' ? 'translateX(0)' : 'translateX(100%)',
          }}
        />
      </div>

      {/* Active workflow progress indicator */}
      {workflowSteps.length > 0 && activeTab === 'chat' && (
        <div className="px-4 py-2 bg-orange-500/10 border-b border-orange-500/20 shrink-0">
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

      {/* Tab content */}
      {activeTab === 'chat' ? (
        <>
          {/* Scrollable chat */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-label="Conversation messages" aria-live="polite">
            {transcript.length === 0 && actions.length === 0 ? (
              /* Empty state with prompt chips */
              <div className="flex flex-col items-center justify-center h-full space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-brand-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-brand-400" />
                  </div>
                  <p className="text-sm text-slate-400">Start a conversation with Aria</p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full max-w-[260px]">
                  {PROMPT_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => isActive && onSendText(chip)}
                      disabled={!isActive}
                      className="prompt-chip disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Interleave transcript and actions by timestamp */
              [...transcript.map(t => ({ ...t, _kind: 'transcript' as const })),
                ...actions.map(a => ({ ...a, _kind: 'action' as const }))]
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
                .map((item) => {
                  if (item._kind === 'transcript') {
                    const entry = item as TranscriptEntry & { _kind: 'transcript' };
                    if (entry.role === 'system') return null;
                    return (
                      <div key={entry.id} className="flex animate-bubble-enter">
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
                })
            )}
          </div>

          {/* Text input bar */}
          <div className="p-3 border-t border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!isActive}
                placeholder={isActive ? 'Type a message...' : 'Start a session to chat'}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08]
                           text-white placeholder-slate-500 outline-none
                           focus:border-brand-500/50 focus:bg-white/[0.06]
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!isActive || !inputText.trim()}
                className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-700
                           disabled:opacity-30 disabled:cursor-not-allowed
                           transition-colors shrink-0"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Activity tab — dashboard cards */
        <div className="flex-1 overflow-y-auto">
          <DashboardPanel cards={dashboardCards} />
          {dashboardCards.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Activity className="w-8 h-8 text-slate-600 mb-3" />
              <p className="text-sm text-slate-500">No activity yet</p>
              <p className="text-xs text-slate-600 mt-1">Tool results and actions will appear here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
