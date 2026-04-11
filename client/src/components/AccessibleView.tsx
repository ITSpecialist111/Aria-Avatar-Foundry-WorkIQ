import { useRef, useEffect } from 'react';
import { Mic, MicOff, PhoneOff, Volume2, Eye, Type, Contrast, Bell, BellOff } from 'lucide-react';
import type { TranscriptEntry, AgentAction } from '../types';
import type { WorkflowStep } from '../hooks/useVoiceLive';
import type { FontSize } from '../hooks/useAccessibility';
import type { SessionState } from '../types';

interface AccessibleViewProps {
  transcript: TranscriptEntry[];
  actions: AgentAction[];
  workflowSteps: WorkflowStep[];
  audioRef: React.RefObject<HTMLAudioElement | null>;
  sessionState: SessionState;
  isMuted: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  onToggleSession: () => void;
  onToggleMute: () => void;
  onConfirmAction: (actionId: string) => void;
  onRejectAction: (actionId: string) => void;
  onToggleMode: () => void;
  fontSize: FontSize;
  onSetFontSize: (size: FontSize) => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  earcons: boolean;
  onToggleEarcons: () => void;
}

const FONT_SIZES: { label: string; value: FontSize }[] = [
  { label: 'A', value: 'normal' },
  { label: 'A', value: 'large' },
  { label: 'A', value: 'x-large' },
];

const STATUS_LABELS: Record<SessionState, string> = {
  disconnected: 'Session not started',
  connecting: 'Connecting to Aria...',
  connected: 'Connected — ready to listen',
  active: 'Active conversation',
  reconnecting: 'Reconnecting...',
  error: 'Connection error',
};

export function AccessibleView({
  transcript,
  actions,
  workflowSteps,
  audioRef,
  sessionState,
  isMuted,
  isSpeaking,
  isListening,
  onToggleSession,
  onToggleMute,
  onConfirmAction,
  onRejectAction,
  onToggleMode,
  fontSize,
  onSetFontSize,
  highContrast,
  onToggleHighContrast,
  earcons,
  onToggleEarcons,
}: AccessibleViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, actions]);

  const fontClass = fontSize === 'x-large' ? 'text-xl' : fontSize === 'large' ? 'text-lg' : 'text-base';
  const isActive = sessionState === 'active' || sessionState === 'connected';

  return (
    <div className="h-screen flex flex-col bg-slate-950" role="application" aria-label="Aria AI Executive Assistant - Accessible Mode">
      {/* Accessibility toolbar */}
      <header className="flex items-center justify-between px-6 py-3 border-b-2 border-slate-700 bg-slate-900" role="toolbar" aria-label="Accessibility controls">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">Aria</h1>

          {/* Status indicator — large and clear */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm ${
              sessionState === 'active' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/50' :
              sessionState === 'connected' ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50' :
              sessionState === 'connecting' ? 'bg-amber-600/20 text-amber-300 border border-amber-500/50' :
              sessionState === 'error' ? 'bg-red-600/20 text-red-300 border border-red-500/50' :
              'bg-slate-700/50 text-slate-400 border border-slate-600'
            }`}
            role="status"
            aria-live="polite"
          >
            <div className={`w-3 h-3 rounded-full ${
              sessionState === 'active' ? 'bg-emerald-400' :
              sessionState === 'connected' ? 'bg-blue-400' :
              sessionState === 'connecting' ? 'bg-amber-400 animate-pulse' :
              sessionState === 'error' ? 'bg-red-400' :
              'bg-slate-500'
            }`} />
            {STATUS_LABELS[sessionState]}
          </div>

          {/* Speaking/Listening indicator */}
          {isActive && (
            <div className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
              {isSpeaking && (
                <span className="flex items-center gap-1 text-purple-300">
                  <Volume2 className="w-4 h-4" />
                  Aria is speaking
                </span>
              )}
              {isListening && !isSpeaking && (
                <span className="flex items-center gap-1 text-emerald-300">
                  <Mic className="w-4 h-4" />
                  Listening
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Font size controls */}
          <div className="flex items-center gap-1 mr-2" role="group" aria-label="Font size">
            <Type className="w-4 h-4 text-slate-400" />
            {FONT_SIZES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => onSetFontSize(value)}
                className={`px-2 py-1 rounded font-medium transition-colors ${
                  fontSize === value
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                } ${value === 'x-large' ? 'text-lg' : value === 'large' ? 'text-base' : 'text-sm'}`}
                aria-label={`${value === 'x-large' ? 'Extra large' : value === 'large' ? 'Large' : 'Normal'} text`}
                aria-pressed={fontSize === value}
              >
                {label}
              </button>
            ))}
          </div>

          {/* High contrast toggle */}
          <button
            onClick={onToggleHighContrast}
            className={`p-2 rounded-lg transition-colors ${highContrast ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            aria-label={`High contrast ${highContrast ? 'on' : 'off'}`}
            aria-pressed={highContrast}
          >
            <Contrast className="w-5 h-5" />
          </button>

          {/* Earcons toggle */}
          <button
            onClick={onToggleEarcons}
            className={`p-2 rounded-lg transition-colors ${earcons ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            aria-label={`Audio feedback ${earcons ? 'on' : 'off'}`}
            aria-pressed={earcons}
          >
            {earcons ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </button>

          {/* Switch back to standard mode */}
          <button
            onClick={onToggleMode}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors"
            aria-label="Switch to standard mode with avatar"
          >
            <Eye className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main content area — full width chat, no dashboard sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation — primary content, fills full width */}
        <main className="flex-1 flex flex-col min-h-0" role="main" aria-label="Conversation with Aria">
          {/* Workflow progress */}
          {workflowSteps.length > 0 && (
            <div className="px-6 py-3 bg-orange-500/10 border-b border-orange-500/20" role="status" aria-live="polite">
              <div className="flex items-center gap-2 text-sm text-orange-300 font-medium">
                <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse" aria-hidden="true" />
                Workflow: {workflowSteps.filter(s => s.status === 'completed').length} of {workflowSteps.length} steps complete
              </div>
              <div className="mt-2 space-y-1">
                {workflowSteps.map((step, i) => (
                  <div key={i} className={`flex items-center gap-2 ${fontClass}`}>
                    <span className={step.status === 'completed' ? 'text-green-400' : step.status === 'failed' ? 'text-red-400' : 'text-orange-300'} aria-hidden="true">
                      {step.status === 'completed' ? '\u2713' : step.status === 'failed' ? '\u2717' : '\u25CB'}
                    </span>
                    <span className="text-slate-300">
                      {step.toolName}
                      <span className="sr-only"> — {step.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
            role="log"
            aria-label="Conversation messages"
            aria-live="polite"
          >
            {transcript.length === 0 && actions.length === 0 && (
              <div className={`text-center text-slate-400 mt-16 ${fontClass}`}>
                <p className="font-medium">Welcome to Aria — Accessible Mode</p>
                <p className="mt-2 text-slate-500">
                  Voice is the primary interface. Press Start Session, then speak naturally.
                </p>
                <p className="mt-1 text-slate-500">
                  All responses will appear here as text. Use the toolbar above to adjust font size and contrast.
                </p>
              </div>
            )}

            {[...transcript.map(t => ({ ...t, _kind: 'transcript' as const })),
              ...actions.map(a => ({ ...a, _kind: 'action' as const }))]
              .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
              .map((item) => {
                if (item._kind === 'transcript') {
                  const entry = item as TranscriptEntry & { _kind: 'transcript' };
                  if (entry.role === 'system') return null;

                  return (
                    <div
                      key={entry.id}
                      className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      role="article"
                      aria-label={`${entry.role === 'user' ? 'You' : 'Aria'} said`}
                    >
                      <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${fontClass} leading-relaxed ${
                        entry.role === 'user'
                          ? 'bg-brand-600 text-white'
                          : highContrast
                            ? 'bg-slate-700 text-white border-2 border-slate-500'
                            : 'bg-slate-800 text-slate-200'
                      }`}>
                        <div className="sr-only">{entry.role === 'user' ? 'You' : 'Aria'}:</div>
                        {entry.content}
                        {entry.isInterim && (
                          <span className="text-sm opacity-50 ml-2" aria-label="still speaking">...</span>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  const action = item as AgentAction & { _kind: 'action' };
                  return (
                    <div
                      key={action.id}
                      className={`mx-auto max-w-[80%] rounded-xl px-5 py-3 border ${
                        action.status === 'completed' ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-200' :
                        action.status === 'failed' ? 'bg-red-900/30 border-red-500/40 text-red-200' :
                        action.status === 'executing' ? 'bg-blue-900/30 border-blue-500/40 text-blue-200' :
                        'bg-slate-800 border-slate-700 text-slate-300'
                      } ${fontClass}`}
                      role="article"
                      aria-label={`Action: ${action.summary} — ${action.status}`}
                    >
                      <p className="font-medium">{action.summary}</p>
                      <p className="text-sm mt-1 opacity-75">
                        Status: {action.status.charAt(0).toUpperCase() + action.status.slice(1)}
                      </p>
                      {action.requiresConfirmation && action.status === 'pending' && (
                        <div className="flex gap-3 mt-3">
                          <button
                            onClick={() => onConfirmAction(action.id)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium transition-colors text-white"
                            aria-label={`Approve: ${action.summary}`}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => onRejectAction(action.id)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                            aria-label={`Reject: ${action.summary}`}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }
              })}
          </div>

          {/* Bottom controls — large, accessible buttons */}
          <div className="flex items-center justify-center gap-4 px-6 py-4 border-t-2 border-slate-700 bg-slate-900" role="toolbar" aria-label="Session controls">
            {isActive ? (
              <>
                <button
                  onClick={onToggleMute}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-base transition-colors ${
                    isMuted
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                  aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  aria-pressed={isMuted}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  onClick={onToggleSession}
                  className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-semibold text-base text-white transition-colors"
                  aria-label="End session with Aria"
                >
                  <PhoneOff className="w-5 h-5" />
                  End Session
                </button>
              </>
            ) : (
              <button
                onClick={onToggleSession}
                className="flex items-center gap-2 px-10 py-4 bg-brand-600 hover:bg-brand-700 rounded-xl font-bold text-lg text-white transition-colors"
                aria-label="Start session with Aria"
              >
                <Mic className="w-6 h-6" />
                Start Session
              </button>
            )}
          </div>
        </main>
      </div>

      {/* Hidden audio element for WebRTC voice output — no video needed in accessible mode */}
      <audio ref={audioRef} autoPlay className="hidden" />
    </div>
  );
}
