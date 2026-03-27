import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import type { AvatarConfig, SessionState } from '../types';

interface AvatarViewProps {
  avatarConfig: AvatarConfig;
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  sessionState: SessionState;
  onToggleSession: () => void;
  onToggleMute: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export function AvatarView({
  avatarConfig,
  isListening,
  isSpeaking,
  isMuted,
  sessionState,
  onToggleSession,
  onToggleMute,
  videoRef,
  audioRef,
}: AvatarViewProps) {
  const isActive = sessionState === 'connected' || sessionState === 'active';

  return (
    <div className="avatar-container h-full flex flex-col items-center justify-center"
         style={{ backgroundColor: avatarConfig.backgroundColor }}>
      {/* Avatar video */}
      <div className="relative flex-1 w-full flex items-center justify-center min-h-0">
        {isActive ? (
          <>
            <video
              id="avatar-video"
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="avatar-video max-h-full"
            />
            <audio ref={audioRef} autoPlay />
          </>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <span className="text-5xl font-bold">A</span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Aria</h2>
              <p className="text-slate-400">AI Executive Assistant</p>
            </div>
            {sessionState === 'connecting' && (
              <p className="text-brand-400 animate-pulse">Connecting...</p>
            )}
          </div>
        )}

        {/* Speaking indicator */}
        {isSpeaking && isActive && (
          <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/20 border border-brand-500/30">
            <div className="w-2 h-2 bg-brand-400 rounded-full animate-pulse" />
            <span className="text-xs text-brand-300">Aria is speaking</span>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-4 p-6 shrink-0">
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
          disabled={sessionState === 'connecting'}
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
              {sessionState === 'connecting' ? 'Connecting...' : 'Start Conversation'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
