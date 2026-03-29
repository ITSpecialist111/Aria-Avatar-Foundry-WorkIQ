import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginScopes } from './auth/msalConfig';
import { AvatarView } from './components/AvatarView';
import { ConversationPanel } from './components/ConversationPanel';
import { StatusBar } from './components/StatusBar';
import { TickerBar } from './components/TickerBar';
import { DemoControls } from './components/DemoControls';
import { AccessibleView } from './components/AccessibleView';
import { useVoiceLive } from './hooks/useVoiceLive';
import { useAccessibility } from './hooks/useAccessibility';
import { DEFAULT_AVATAR_CONFIG, DEFAULT_VOICE_CONFIG } from './types';
import { useState } from 'react';
import type { AvatarConfig, VoiceConfig } from './types';

function LoginScreen() {
  const { instance, inProgress } = useMsal();
  const isLoading = inProgress !== InteractionStatus.None;

  const handleLogin = () => {
    instance.loginRedirect(loginScopes).catch(console.error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="glass-panel p-12 max-w-md w-full text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
            Aria
          </h1>
          <p className="text-slate-400 text-lg">AI Executive Assistant</p>
          <p className="text-slate-500 text-sm">
            Powered by Microsoft Foundry &bull; Voice Live &bull; HD Avatar
          </p>
        </div>
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50
                     rounded-xl font-medium transition-colors text-white"
        >
          {isLoading ? 'Signing in...' : 'Sign in with Microsoft'}
        </button>
      </div>
    </div>
  );
}

function MainApp() {
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);
  const [voiceConfig] = useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);
  const [showControls, setShowControls] = useState(false);

  const voiceLive = useVoiceLive({ avatarConfig, voiceConfig });
  const accessibility = useAccessibility();

  // Accessible mode — full-screen chat, no avatar
  if (accessibility.mode === 'accessible') {
    return (
      <AccessibleView
        transcript={voiceLive.transcript}
        actions={voiceLive.actions}
        dashboardCards={voiceLive.dashboardCards}
        workflowSteps={voiceLive.workflowSteps}
        sessionState={voiceLive.sessionState}
        isMuted={voiceLive.isMuted}
        isSpeaking={voiceLive.isSpeaking}
        isListening={voiceLive.isListening}
        onToggleSession={voiceLive.toggleSession}
        onToggleMute={voiceLive.toggleMute}
        onConfirmAction={voiceLive.confirmAction}
        onRejectAction={voiceLive.rejectAction}
        onToggleMode={accessibility.toggleMode}
        fontSize={accessibility.fontSize}
        onSetFontSize={accessibility.setFontSize}
        highContrast={accessibility.highContrast}
        onToggleHighContrast={accessibility.toggleHighContrast}
        earcons={accessibility.earcons}
        onToggleEarcons={accessibility.toggleEarcons}
      />
    );
  }

  // Standard mode — avatar + side panel
  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      <StatusBar
        sessionState={voiceLive.sessionState}
        agentName="Aria"
        onToggleControls={() => setShowControls((prev) => !prev)}
        onToggleAccessibility={accessibility.toggleMode}
      />
      <TickerBar
        transcript={voiceLive.transcript}
        sessionActive={voiceLive.sessionState === 'active' || voiceLive.sessionState === 'connected'}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Avatar — left/center area */}
        <div className="flex-1 relative p-4">
          <AvatarView
            avatarConfig={avatarConfig}
            isListening={voiceLive.isListening}
            isSpeaking={voiceLive.isSpeaking}
            isMuted={voiceLive.isMuted}
            sessionState={voiceLive.sessionState}
            onToggleSession={voiceLive.toggleSession}
            onToggleMute={voiceLive.toggleMute}
            videoRef={voiceLive.videoRef}
            audioRef={voiceLive.audioRef}
          />
        </div>

        {/* Conversation panel — right side */}
        <div className="w-[400px] shrink-0 flex flex-col border-l border-slate-800 min-h-0">
          <ConversationPanel
            transcript={voiceLive.transcript}
            actions={voiceLive.actions}
            dashboardCards={voiceLive.dashboardCards}
            workflowSteps={voiceLive.workflowSteps}
            onConfirmAction={voiceLive.confirmAction}
            onRejectAction={voiceLive.rejectAction}
          />
        </div>
      </div>

      {/* Demo controls overlay */}
      {showControls && (
        <DemoControls
          avatarConfig={avatarConfig}
          onAvatarChange={setAvatarConfig}
          onClose={() => setShowControls(false)}
          onSelectScenario={(scenario) => {
            voiceLive.sendTextMessage(scenario.promptHint);
            setShowControls(false);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  const isAuthenticated = useIsAuthenticated();
  return isAuthenticated ? <MainApp /> : <LoginScreen />;
}
