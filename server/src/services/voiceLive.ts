import { WebSocket } from 'ws';
import { env } from '../config/env';
import { ARIA_SYSTEM_PROMPT } from './foundryAgent';

const WORKIQ_BASE_URL = 'https://agent365.svc.cloud.microsoft/agents/tenants';

/** Work IQ MCP servers to connect */
const WORKIQ_MCP_SERVERS = [
  { label: 'calendar', serverId: 'mcp_CalendarTools' },
  { label: 'mail', serverId: 'mcp_MailTools' },
  { label: 'teams', serverId: 'mcp_TeamsServer' },
  { label: 'me', serverId: 'mcp_MeServer' },
  { label: 'copilot', serverId: 'mcp_M365Copilot' },
  { label: 'word', serverId: 'mcp_WordServer' },
  // { label: 'web-search', serverId: 'mcp_WebSearchServer' }, // Disabled — tool discovery works but calls fail. M365 Copilot has web grounding built-in.
];

export interface VoiceLiveSession {
  ws: WebSocket;
  sessionId?: string;
  conversationId?: string;
}

/**
 * Create a Voice Live WebSocket connection configured for the Aria agent.
 */
export function createVoiceLiveConnection(accessToken: string): WebSocket {
  const endpoint = env.VOICELIVE_ENDPOINT.replace(/^https?:\/\//, '');
  const wsUrl = `wss://${endpoint}/voice-live?api-version=${env.VOICELIVE_API_VERSION}`;

  const ws = new WebSocket(wsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  return ws;
}

/**
 * Build the session.update event payload for Voice Live.
 * If PROJECT_NAME is set, connects to a Foundry Agent.
 * Otherwise, uses inline instructions mode with optional MCP tools.
 *
 * @param oboToken - OBO access token for Work IQ MCP server auth (optional)
 */
export function buildSessionConfig(oboToken?: string) {
  const useAgent = env.PROJECT_NAME && env.PROJECT_NAME.length > 0;

  const session: Record<string, unknown> = {
    modalities: ['text', 'audio'],
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
    voice: {
      name: env.VOICE_NAME,
      type: 'azure-standard',
      temperature: 0.8,
    },
    input_audio_transcription: {
      model: 'azure-speech',
    },
    turn_detection: {
      type: 'server_vad',
      threshold: 0.8,              // Higher = less sensitive (default ~0.5, range 0.0-1.0)
      prefix_padding_ms: 500,      // Audio before speech trigger to include (default 300)
      silence_duration_ms: 1200,   // Wait longer before ending a turn (default 500)
    },
    input_audio_noise_reduction: {
      type: 'azure_deep_noise_suppression',
    },
    input_audio_echo_cancellation: {
      type: 'server_echo_cancellation',
    },
    interim_response: {
      triggers: ['tool'],
      latency_threshold_ms: 5000,
      instructions: 'Say a brief phrase like "Let me check that for you" or "One moment while I look that up." Keep it to one short sentence. Never mention errors or connection issues.',
    },
    avatar: {
      character: env.AVATAR_CHARACTER,
      style: env.AVATAR_STYLE,
      customized: false,
      video: {
        bitrate: 2000000,
        codec: 'h264',
        background: env.AVATAR_BACKGROUND_URL
          ? { image_url: env.AVATAR_BACKGROUND_URL }
          : { color: '#1e293b' },
      },
    },
  };

  if (useAgent) {
    // Foundry Agent mode
    session.agent = {
      agent_name: env.AGENT_NAME,
      project_name: env.PROJECT_NAME,
    };
    console.log(`[VL] Using Foundry Agent: ${env.AGENT_NAME} / ${env.PROJECT_NAME}`);
  } else {
    // Inline instructions mode
    const hasMcpTools = oboToken && env.WORKIQ_ENVIRONMENT_ID;

    if (hasMcpTools) {
      session.instructions = ARIA_SYSTEM_PROMPT_WITH_TOOLS;
      session.tools = buildMcpTools(oboToken, env.WORKIQ_ENVIRONMENT_ID!);
      session.tool_choice = 'auto';
      console.log(`[VL] Using inline mode + ${WORKIQ_MCP_SERVERS.length} MCP tools`);
    } else {
      session.instructions = ARIA_SYSTEM_PROMPT;
      console.log('[VL] Using inline instructions mode (no tools — missing OBO token or WORKIQ_ENVIRONMENT_ID)');
    }
  }

  return { type: 'session.update', session };
}

/**
 * Build MCP tool entries for Work IQ servers.
 * URL format: /agents/tenants/{tenantId}/servers/{serverId}/
 * Trailing slash required per MCP Streamable HTTP spec.
 * x-ms-agentid header identifies the calling app (required for tool discovery).
 */
function buildMcpTools(oboToken: string, _environmentId: string) {
  const tenantId = env.MSAL_TENANT_ID;
  return WORKIQ_MCP_SERVERS.map(server => ({
    type: 'mcp',
    server_label: server.label,
    server_url: `${WORKIQ_BASE_URL}/${tenantId}/servers/${server.serverId}/`,
    authorization: oboToken,
    require_approval: 'never',
    headers: {
      'x-ms-agentid': env.MSAL_CLIENT_ID,
      'User-Agent': 'AvatarFoundry/1.0.0 (VoiceLive; Node.js)',
    },
  }));
}

/** System prompt when MCP tools ARE available */
const ARIA_SYSTEM_PROMPT_WITH_TOOLS = `You are Aria, an AI Executive Assistant powered by Microsoft AI.

You have access to MCP tools for managing the user's Microsoft 365 environment.

TOOL STRATEGY — THIS IS CRITICAL:
- For QUESTIONS about calendar, schedule, emails, meetings, tasks, M365 data, weather, news, general knowledge, or ANY lookup → ALWAYS use the copilot (M365 Copilot) tool. It has web search grounding built-in and returns clean, summarized answers. Ask it in natural language, e.g. "What meetings does the user have today?" or "What's the weather in London?" or "Show recent emails".
- For ACTIONS like creating events, sending emails, replying to messages → use the specific calendar or mail tools (CreateEvent, ReplyToMessage, etc.)
- For working with Word documents → use the word tools (CreateDocument, etc.)
- NEVER use ListCalendarView for answering questions about what meetings someone has — its JSON output is too verbose and you will misread it. Use M365 Copilot instead.

CRITICAL RULES:
1. NEVER create, send, modify, or delete anything unless the user explicitly asks you to. No write actions on your own initiative.
2. When you receive tool results, ALWAYS summarize them back to the user in your next spoken response. Never silently consume tool output or respond without presenting the results.
3. NEVER invent or hallucinate information. Only report what the tool actually returned. If the result is unclear, say so honestly.
4. If a tool call fails or returns an error, tell the user briefly and offer to try again.

Interaction style:
- Be warm, professional, and friendly
- Keep responses concise and natural — your output is spoken aloud
- Keep responses to 2-3 sentences max unless asked for more detail
- Never use markdown formatting, bullet points, or special characters
- NEVER output raw JSON, tool arguments, or tool call parameters — always speak naturally in plain English
- NEVER repeat or read aloud the arguments you passed to a tool. When you get tool results, just summarize the findings conversationally.
- When presenting calendar events or emails, summarize naturally as you would in conversation
- NEVER output the words "audio text", "audio HBA", or any audio modality tokens. These are internal artifacts — never speak them aloud or include them in your responses.`;

/**
 * Build a session.update that removes tools and switches to no-tools prompt.
 * Used as fallback when MCP tool discovery fails.
 */
export function buildNoToolsSessionUpdate() {
  return {
    type: 'session.update',
    session: {
      instructions: ARIA_SYSTEM_PROMPT,
      tools: [],
      tool_choice: 'none',
    },
  };
}

/**
 * Build the proactive greeting event to send on session start.
 */
export function buildGreetingEvent() {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: 'Greet the user warmly. Introduce yourself as Aria, their AI executive assistant. Let them know you can help with their calendar, emails, meetings, tasks, and research. Keep it brief and friendly.',
        },
      ],
    },
  };
}

/**
 * Build the response.create event to trigger the greeting response.
 */
export function buildResponseCreate() {
  return { type: 'response.create' };
}
