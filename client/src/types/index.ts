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

/** Dashboard card types for side-panel activity feed */
export type DashboardCardType = 'calendar' | 'email' | 'task' | 'info' | 'action' | 'weather' | 'link';

export interface DashboardCard {
  id: string;
  type: DashboardCardType;
  title: string;
  content: string;
  items?: Array<{ label: string; value: string }>;
  timestamp: number;
  toolName?: string;
  linkUrl?: string;
  linkLabel?: string;
}

/** Ticker data from /api/ticker */
export interface TickerData {
  weather: {
    temperature: number;
    feelsLike: number;
    condition: string;
    icon: string;
    location: string;
    humidity: number;
    windSpeed: number;
  } | null;
  timestamp: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'morning-briefing',
    name: '🌅 Morning Briefing',
    description: 'Full auto-pilot: calendar, emails, follow-ups, weather, and news in one go',
    promptHint: 'Good morning Aria! Give me a full morning briefing — my calendar today, any important emails, pending follow-ups, the weather in London, and any relevant news.',
  },
  {
    id: 'email-triage',
    name: '📧 Email Triage',
    description: 'Aria scans your inbox and prioritizes what needs attention',
    promptHint: 'Aria, check my recent emails and tell me which ones need my attention first. Prioritize by importance and suggest what actions I should take.',
  },
  {
    id: 'schedule-meeting',
    name: '📅 Schedule a Meeting',
    description: 'Have Aria check availability and create a Teams meeting',
    promptHint: 'Schedule a 30-minute Teams meeting with Sarah tomorrow afternoon to discuss the Q2 roadmap',
  },
  {
    id: 'draft-email',
    name: '✉️ Draft & Send Email',
    description: 'Aria composes and sends an email on your behalf',
    promptHint: 'Draft an email to the marketing team with a project update on the Q2 launch. Keep it professional but friendly.',
  },
  {
    id: 'meeting-prep',
    name: '🎯 Meeting Prep',
    description: 'Get fully prepared for your next meeting — attendees, context, and agenda',
    promptHint: 'Help me prepare for my next meeting. Who is attending, what was discussed last time, and are there any relevant recent emails from the attendees?',
  },
  {
    id: 'research-delegate',
    name: '🔬 Deep Research',
    description: 'Delegate a complex research task to the background AI research agent',
    promptHint: 'I need research on the latest trends in AI-powered executive assistants for 2026. Delegate this to the research agent and give me a comprehensive summary.',
  },
  {
    id: 'create-document',
    name: '📄 Create Document',
    description: 'Have Aria create a Word document from a conversation or topic',
    promptHint: 'Create a Word document with a project status report for Q2 2026, including sections for accomplishments, challenges, and next steps.',
  },
  {
    id: 'follow-ups',
    name: '✅ Follow-Up Check',
    description: 'Review and manage your tracked follow-up items',
    promptHint: 'What follow-ups do I have pending? Give me a rundown and let me know which ones are due soon.',
  },
  {
    id: 'team-comms',
    name: '💬 Teams Summary',
    description: 'Get a summary of recent Teams messages and conversations',
    promptHint: 'Summarize my recent Teams messages. Are there any urgent conversations or mentions I need to respond to?',
  },
  {
    id: 'end-of-day',
    name: '🌙 End of Day Wrap-Up',
    description: 'Aria summarizes what you accomplished today and sets up tomorrow',
    promptHint: 'Give me an end-of-day summary. What meetings did I have today, any emails I should follow up on before tomorrow, and what does my schedule look like first thing in the morning?',
  },
];
