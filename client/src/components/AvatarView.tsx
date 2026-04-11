import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import type { AvatarConfig, SessionState, DashboardCard } from '../types';
import type { WorkflowStep } from '../hooks/useVoiceLive';
import { ToolCallOverlay } from './ToolCallOverlay';
import { DataOverlay } from './DataOverlay';
import { ParticleField } from './ParticleField';
import { QuickLaunchBar } from './QuickLaunchBar';

interface AvatarViewProps {
  avatarConfig: AvatarConfig;
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  isToolCallActive: boolean;
  sessionState: SessionState;
  workflowSteps: WorkflowStep[];
  dashboardCards: DashboardCard[];
  onToggleSession: () => void;
  onToggleMute: () => void;
  onSendText: (text: string) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export function AvatarView({
  avatarConfig: _avatarConfig,
  isListening,
  isSpeaking,
  isMuted,
  isToolCallActive,
  sessionState,
  workflowSteps,
  dashboardCards,
  onToggleSession,
  onToggleMute,
  onSendText,
  videoRef,
  audioRef,
}: AvatarViewProps) {
  const isActive = sessionState === 'connected' || sessionState === 'active';
  const [showVideo, setShowVideo] = useState(false);
  const [logoExiting, setLogoExiting] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const lastActivityRef = useRef(Date.now());

  // Cinematic reveal: when session becomes active, animate logo out → video in
  useEffect(() => {
    if (isActive && !showVideo) {
      setLogoExiting(true);
      const timer = setTimeout(() => {
        setShowVideo(true);
        setLogoExiting(false);
      }, 400);
      return () => clearTimeout(timer);
    }
    if (!isActive) {
      setShowVideo(false);
      setLogoExiting(false);
    }
  }, [isActive, showVideo]);

  // Track idle time for quick-launch visibility
  useEffect(() => {
    if (isSpeaking || isListening || isToolCallActive) {
      lastActivityRef.current = Date.now();
      setIdleSeconds(0);
    }
  }, [isSpeaking, isListening, isToolCallActive]);

  useEffect(() => {
    if (!isActive) { setIdleSeconds(0); return; }
    const interval = setInterval(() => {
      setIdleSeconds(Math.floor((Date.now() - lastActivityRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const handleQuickLaunch = useCallback((prompt: string) => {
    onSendText(prompt);
    lastActivityRef.current = Date.now();
    setIdleSeconds(0);
  }, [onSendText]);

  // Determine aura state
  const auraClass = isToolCallActive
    ? 'aura-thinking'
    : isSpeaking
      ? 'aura-speaking'
      : isListening
        ? 'aura-listening'
        : 'aura-idle';

  return (
    <div className="avatar-container h-full flex flex-col items-center justify-center">
      {/* Avatar video area */}
      <div className="relative flex-1 w-full flex items-center justify-center min-h-0">
        {/* Particle field behind everything */}
        {isActive && (
          <ParticleField
            isSpeaking={isSpeaking}
            isToolCallActive={isToolCallActive}
          />
        )}

        {/* Aura ring */}
        {isActive && showVideo && (
          <div className={`avatar-aura ${auraClass}`} />
        )}

        {isActive && showVideo ? (
          <>
            <video
              id="avatar-video"
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="avatar-video w-full h-full object-cover avatar-reveal"
              style={{ position: 'relative', zIndex: 2 }}
            />
            <audio ref={audioRef} autoPlay />
          </>
        ) : (
          <div className={`text-center space-y-4 avatar-idle-logo ${sessionState === 'connecting' ? 'connecting' : ''} ${logoExiting ? 'exit' : ''}`}>
            <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <span className="text-5xl font-bold">A</span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Aria</h2>
              <p className="text-slate-400">AI Executive Assistant</p>
            </div>
            {sessionState === 'connecting' && (
              <p className="text-brand-400 animate-pulse">Connecting...</p>
            )}
            {sessionState === 'reconnecting' && (
              <div className="space-y-2">
                <p className="text-amber-400 animate-pulse">Reconnecting...</p>
                <p className="text-slate-500 text-xs">Session interrupted — retrying automatically</p>
              </div>
            )}
          </div>
        )}

        {/* Data overlay cards — float over avatar */}
        {isActive && showVideo && (
          <DataOverlay dashboardCards={dashboardCards} />
        )}

        {/* Speaking indicator */}
        {isSpeaking && isActive && showVideo && (
          <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/20 border border-brand-500/30 backdrop-blur-md"
               style={{ zIndex: 15 }}>
            <div className="w-2 h-2 bg-brand-400 rounded-full animate-pulse" />
            <span className="text-xs text-brand-300">Aria is speaking</span>
          </div>
        )}

        {/* Tool Call Overlay — slides up from bottom */}
        {isActive && showVideo && (
          <ToolCallOverlay
            workflowSteps={workflowSteps}
            isToolCallActive={isToolCallActive}
          />
        )}

        {/* Quick Launch Bar — visible after 5s idle */}
        {isActive && showVideo && idleSeconds >= 5 && !isSpeaking && !isToolCallActive && (
          <QuickLaunchBar onSelect={handleQuickLaunch} />
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-4 p-6 shrink-0" style={{ zIndex: 20 }}>
        {/* Mute button */}
        {isActive && (
          <button
            onClick={onToggleMute}
            className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border transition-all
              ${isMuted
                ? 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30'
                : isListening
                  ? 'bg-red-500/10 border-red-500/50 hover:bg-red-500/20'
                  : 'bg-white/10 border-white/20 hover:bg-white/20'
              }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? (
              <>
                <MicOff className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-300">Muted</span>
              </>
            ) : (
              <>
                <div className={`w-3 h-3 rounded-full transition-colors ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-sm text-slate-300">
                  {isListening ? 'Listening...' : 'Idle'}
                </span>
                <Mic className={`w-4 h-4 ${isListening ? 'text-red-400' : 'text-slate-500'}`} />
              </>
            )}
          </button>
        )}

        {/* Start/End session button */}
        <button
          onClick={onToggleSession}
          disabled={sessionState === 'connecting' || sessionState === 'reconnecting'}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all
            ${isActive
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-brand-600 hover:bg-brand-700 text-white animate-glow'
            }
            disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isActive ? (
            <>
              <PhoneOff className="w-5 h-5" />
              End Session
            </>
          ) : (
            <>
              <Phone className="w-5 h-5" />
              {sessionState === 'connecting' ? 'Connecting...' : sessionState === 'reconnecting' ? 'Reconnecting...' : 'Start Conversation'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
