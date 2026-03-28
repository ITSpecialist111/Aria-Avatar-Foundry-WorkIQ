// ============================================================
// Avatar Foundry — Shared TypeScript Types
// ============================================================

/** Voice Live session states */
export type SessionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'active'
  | 'error';

/** Avatar character options */
export interface AvatarConfig {
  character: 'meg' | 'max' | 'harry' | 'lisa' | 'lori' | 'jeff';
  style: string;
  backgroundColor: string;
  backgroundImageUrl?: string;
  isTransparent: boolean;
}

/** Voice configuration */
export interface VoiceConfig {
  name: string;
  type: 'azure-standard' | 'azure-custom' | 'openai';
  temperature: number;
  speed?: number;
}

/** Voice Live session configuration */
export interface VoiceLiveSessionConfig {
  voice: VoiceConfig;
  inputAudioTranscription: { model: string };
  turnDetection: {
    type: string;
    endOfUtteranceDetection: { model: string };
  };
  inputAudioNoiseReduction: { type: string };
  inputAudioEchoCancellation: { type: string };
}

/** Transcript entry in the conversation */
export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isInterim?: boolean;
}

/** Action taken by the agent */
export interface AgentAction {
  id: string;
  type: 'email' | 'meeting' | 'search' | 'task' | 'chat' | 'file' | 'web_search' | 'user_lookup';
  status: 'pending' | 'confirmed' | 'executing' | 'completed' | 'failed';
  summary: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  requiresConfirmation: boolean;
}

/** WebRTC ICE server info from Azure Speech */
export interface IceServerInfo {
  urls: string[];
  username: string;
  credential: string;
}

/** API response for creating a session */
export interface CreateSessionResponse {
  sessionId: string;
  websocketUrl: string;
  iceServers: IceServerInfo;
}

/** Session status from the server */
export interface SessionStatus {
  state: SessionState;
  agentName: string;
  agentDescription?: string;
  voiceName: string;
  conversationId?: string;
}

/** Demo scenario preset */
export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  promptHint: string;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  character: 'meg',
  style: 'casual',
  backgroundColor: '#1e293b',
  backgroundImageUrl: '/background.jpg',
  isTransparent: false,
};

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  name: 'en-US-Ava:DragonHDLatestNeural',
  type: 'azure-standard',
  temperature: 0.8,
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'morning-briefing',
    name: 'Morning Briefing',
    description: 'Ask Aria to summarize your day, calendar, and important emails',
    promptHint: 'Good morning Aria, what does my day look like?',
  },
  {
    id: 'schedule-meeting',
    name: 'Schedule a Meeting',
    description: 'Have Aria check availability and schedule a Teams meeting',
    promptHint: 'Schedule a 30-minute Teams meeting with Sarah tomorrow afternoon',
  },
  {
    id: 'draft-email',
    name: 'Draft an Email',
    description: 'Ask Aria to compose and send an email on your behalf',
    promptHint: 'Send an email to the marketing team about the Q2 launch update',
  },
  {
    id: 'research-action',
    name: 'Research + Action',
    description: 'Aria searches for information and takes action with the results',
    promptHint: "What's the latest on our competitor's product launch? Summarize and email it to my team",
  },
  {
    id: 'task-management',
    name: 'Task Management',
    description: 'Create and manage tasks through Planner',
    promptHint: 'Create a task to review the budget proposal by Friday',
  },
];
