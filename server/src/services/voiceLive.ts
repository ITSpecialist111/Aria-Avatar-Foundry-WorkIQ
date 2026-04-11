import { env } from '../config/env';
import { ARIA_SYSTEM_PROMPT } from './foundryAgent';
import { getMemorySummary } from './userMemory';
import { getFollowUpSummary } from './followUpTracker';

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

/** Function tools for persistent user memory */
const MEMORY_FUNCTION_TOOLS = [
  {
    type: 'function' as const,
    name: 'remember_user_preference',
    description: 'Save a user preference, fact, or reminder to persistent memory. Use when the user shares personal information, preferences, or asks you to remember something.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['preference', 'fact', 'reminder'], description: 'Type of memory' },
        content: { type: 'string', description: 'What to remember' },
      },
      required: ['category', 'content'],
    },
  },
  {
    type: 'function' as const,
    name: 'recall_user_memories',
    description: 'Retrieve all stored user memories and preferences.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function' as const,
    name: 'forget_user_memory',
    description: 'Delete a specific memory by its ID.',
    parameters: {
      type: 'object',
      properties: {
        memory_id: { type: 'string', description: 'ID of the memory to delete' },
      },
      required: ['memory_id'],
    },
  },
];

/** Function tools for follow-up tracking */
const FOLLOW_UP_FUNCTION_TOOLS = [
  {
    type: 'function' as const,
    name: 'create_follow_up',
    description: 'Create a follow-up reminder for the user. Use when the user mentions something they need to do or follow up on.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'What to follow up on' },
        due_date: { type: 'string', description: 'Optional due date in YYYY-MM-DD format' },
      },
      required: ['description'],
    },
  },
  {
    type: 'function' as const,
    name: 'list_follow_ups',
    description: 'List all pending follow-up reminders.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function' as const,
    name: 'complete_follow_up',
    description: 'Mark a follow-up as completed.',
    parameters: {
      type: 'object',
      properties: {
        follow_up_id: { type: 'string', description: 'ID of the follow-up to complete' },
      },
      required: ['follow_up_id'],
    },
  },
];

/** Function tool for Foundry Agent delegation */
const DELEGATION_FUNCTION_TOOLS = [
  {
    type: 'function' as const,
    name: 'delegate_to_research_agent',
    description: 'Delegate a complex research task to a background AI agent. ONLY use this when the user explicitly asks for deep research, analysis, or comparison — NOT for scheduling meetings, sending emails, checking calendars, or any standard M365 action. Use calendar/mail/copilot tools for those.',
    parameters: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The research task to delegate' },
        context: { type: 'string', description: 'Optional additional context for the research' },
      },
      required: ['task'],
    },
  },
];

/** Function tool for weather lookups */
const WEATHER_FUNCTION_TOOLS = [
  {
    type: 'function' as const,
    name: 'get_weather',
    description: 'Get the current weather for a city. Defaults to London if no city specified. ONLY call this when the user explicitly asks about weather.',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name (default: London)' },
      },
    },
  },
];

/** Function tool for direct Graph API calendar reads (~2-3s vs ~19s via copilot_chat) */
const CALENDAR_FUNCTION_TOOLS = [
  {
    type: 'function' as const,
    name: 'get_calendar_events',
    description: 'Get calendar events for a date range from Microsoft Graph. Returns clean compact data. Much faster than copilot_chat for calendar queries. Use this for ALL calendar read questions: "What meetings do I have today?", "Am I free Thursday?", "Show my schedule for next week".',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date in ISO format, e.g. "2026-04-11T00:00:00Z". Defaults to now.' },
        end_date: { type: 'string', description: 'End date in ISO format, e.g. "2026-04-18T00:00:00Z". Defaults to +7 days.' },
        max_results: { type: 'number', description: 'Max events to return (default 15)' },
      },
    },
  },
];

/** Function tool for direct Graph API email reads (~2-3s vs ~5-6s via MCP with cleaner output) */
const EMAIL_FUNCTION_TOOLS = [
  {
    type: 'function' as const,
    name: 'get_recent_emails',
    description: 'Get recent emails from Microsoft Graph. Returns clean compact data (subject, from, date, preview). Use this for ALL email read questions: "Show my recent emails", "Any emails from John?", "Do I have unread emails?".',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of emails to return (default 10, max 25)' },
        filter: { type: 'string', description: 'Optional OData filter, e.g. "isRead eq false" for unread only' },
        search: { type: 'string', description: 'Optional search query to find specific emails by subject, body, or sender' },
      },
    },
  },
];

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
      instructions: 'Say a brief, contextual phrase while you wait for tool results. For example: "Let me check your calendar" or "Looking that up for you." Keep it to one short sentence. Never mention errors or connection issues.',
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
      session.tools = [...buildMcpTools(oboToken, env.WORKIQ_ENVIRONMENT_ID!), ...MEMORY_FUNCTION_TOOLS, ...FOLLOW_UP_FUNCTION_TOOLS, ...DELEGATION_FUNCTION_TOOLS, ...WEATHER_FUNCTION_TOOLS, ...CALENDAR_FUNCTION_TOOLS, ...EMAIL_FUNCTION_TOOLS];
      session.tool_choice = 'auto';
      console.log(`[VL] Using inline mode + ${WORKIQ_MCP_SERVERS.length} MCP tools + ${MEMORY_FUNCTION_TOOLS.length} memory + ${FOLLOW_UP_FUNCTION_TOOLS.length} follow-up + ${DELEGATION_FUNCTION_TOOLS.length} delegation + ${WEATHER_FUNCTION_TOOLS.length} weather tools`);
    } else {
      session.instructions = ARIA_SYSTEM_PROMPT;
      session.tools = [...MEMORY_FUNCTION_TOOLS, ...FOLLOW_UP_FUNCTION_TOOLS, ...DELEGATION_FUNCTION_TOOLS, ...WEATHER_FUNCTION_TOOLS, ...CALENDAR_FUNCTION_TOOLS, ...EMAIL_FUNCTION_TOOLS];
      session.tool_choice = 'auto';
      console.log(`[VL] Using inline mode with ${MEMORY_FUNCTION_TOOLS.length} memory + ${FOLLOW_UP_FUNCTION_TOOLS.length} follow-up + ${DELEGATION_FUNCTION_TOOLS.length} delegation + ${WEATHER_FUNCTION_TOOLS.length} weather tools (no MCP — missing OBO token or WORKIQ_ENVIRONMENT_ID)`);
    }

    // Inject persistent memory summary into instructions
    const memorySummary = getMemorySummary();
    if (memorySummary) {
      session.instructions += `\n\nUSER MEMORIES (from previous sessions):\n${memorySummary}`;
      console.log(`[VL] Injected ${memorySummary.split('\n').length} memories into system prompt`);
    }

    // Inject pending follow-ups into instructions
    const followUpSummary = getFollowUpSummary();
    if (followUpSummary) {
      session.instructions += `\n\nPENDING FOLLOW-UPS:\n${followUpSummary}`;
      console.log(`[VL] Injected ${followUpSummary.split('\n').length} pending follow-ups into system prompt`);
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

TOOL STRATEGY — THIS IS CRITICAL FOR SPEED:
Your tools have two tiers: FAST function tools and deterministic MCP tools (mail, teams, me, get_calendar_events) that respond in 2-6 seconds, and SLOW copilot_chat which runs an LLM behind the scenes (~15-20 seconds). Always prefer fast tools.

FAST PATH (use these first — sub-5-second responses):
- Calendar READ questions ("What meetings do I have today?", "Am I free Thursday?", "Show my schedule") → use get_calendar_events function tool. It calls Graph API directly and returns clean compact data in ~2-3 seconds.
- Email READ questions ("Show my recent emails", "Any emails from John?", "Do I have unread emails?") → use get_recent_emails function tool. It calls Graph API directly and returns compact data (subject, from, date, preview). Use search parameter for finding specific emails, filter="isRead eq false" for unread.
- User info ("What time zone am I in?", "What's my email?") → use the me server tools: GetMyDetails, GetUserDateAndTimeZoneSettings.
- Teams info → use the teams server tools.
- Calendar ACTIONS (create/update/delete events) → use calendar MCP tools: CreateEvent, UpdateEvent directly. These are fast and reliable.
- Email ACTIONS (reply, send) → use mail MCP tools: ReplyToMessage, SendReplyAll directly.

⚠ NEVER use the MCP calendar read tools (ListCalendarView, ListEvents, SearchCalendarEvents) — they are broken. Always use get_calendar_events instead.
⚠ NEVER use the MCP mail read tools (SearchMessages, SearchMessagesQueryParameters) for reading emails — their raw JSON output is too verbose for voice. Always use get_recent_emails instead. Only use MCP mail tools for ACTIONS (reply, send).
- copilot_chat is slower (~15s) but returns clean summarized text that works reliably for voice.

SLOW PATH (copilot_chat — only when fast tools cannot answer):
- Use copilot_chat for: complex analytical questions, questions that span multiple data sources, web/news queries, or when you need LLM reasoning. Set enableWebSearch=true when the question needs web grounding.
- Examples: "Summarize the key themes from my emails this week", "What's in the news about AI?", "Find information about company X".

NEVER use copilot_chat for calendar queries (use get_calendar_events instead), simple email searches, or user profile queries — the fast tools are 5-10x faster.
⚠ NEVER use the MCP calendar read tools (ListCalendarView, ListEvents, SearchCalendarEvents). They are broken. Use get_calendar_events for all calendar reads.
- For working with Word documents → use the word tools (CreateDocument, etc.)
- NEVER call delegate_to_research_agent for calendar, email, meeting, or standard M365 actions. That tool is ONLY for deep research analysis when the user explicitly asks.
- NEVER call get_weather unless the user explicitly says the word "weather".
- When scheduling a meeting: use CreateEvent directly. Do NOT first check what other meetings exist unless the user asks.
- When asked to create, schedule, or update a meeting, proceed immediately with the calendar tool. Do not ask about time zones — use the user's default time zone from their M365 profile.

CRITICAL RULES:
1. NEVER create, send, modify, or delete anything unless the user explicitly asks you to. No write actions on your own initiative.
2. When you receive tool results, ALWAYS summarize them back to the user in your next spoken response. Never silently consume tool output or respond without presenting the results.
3. NEVER invent or hallucinate information. Only report what the tool actually returned. If the result is unclear, say so honestly.
4. If a tool call fails or returns an error, tell the user briefly and offer to try again.
5. Keep ALL tool call arguments SHORT. Calendar event bodies must be plain text, max 500 characters — never include HTML, Teams meeting links, or formatting markup. When updating an event, only set the fields you are changing. Do NOT copy or echo back existing event content (e.g. Teams join links) — the server preserves fields you do not set.

Interaction style:
- Be warm, professional, and friendly
- Keep responses concise and natural — your output is spoken aloud
- Keep responses to 2-3 sentences max unless asked for more detail
- Never use markdown formatting, bullet points, or special characters
- NEVER output raw JSON, tool arguments, or tool call parameters — always speak naturally in plain English
- NEVER repeat or read aloud the arguments you passed to a tool. When you get tool results, just summarize the findings conversationally.
- When presenting calendar events, say how many and mention 2-3 key ones by name and time.
- When presenting emails, say how many and mention 2-3 notable ones by sender and subject. NEVER read the raw JSON data — always rephrase as natural speech.
- NEVER output the words "audio text", "audio HBA", or any audio modality tokens. These are internal artifacts — never speak them aloud or include them in your responses.

MULTI-STEP TASKS:
- When the user asks for something that requires multiple actions (e.g., "Schedule a meeting and email the attendees"), break it down into clear steps.
- Execute each step in order. After completing each step, briefly confirm what you did before proceeding to the next.
- If any step fails, stop and inform the user. Do not continue blindly.
- For complex requests, first outline your plan briefly (e.g., "I'll create the event first, then send the email"), then execute.
- Examples: "Schedule a meeting and email the team about it" → Step 1: Create the calendar event. Step 2: Send an email about the new meeting.

MEMORY:
- You have persistent memory across sessions. When the user tells you a preference, fact about themselves, or asks you to remember something, use the remember_user_preference tool to save it.
- At the start of each session, you receive stored memories. Reference them naturally in conversation.
- If the user asks you to forget something, use the forget_user_memory tool.

FOLLOW-UPS:
- You can track follow-up items for the user. When they mention something they need to do or follow up on, offer to track it using the create_follow_up tool.
- At the start of each session, if there are pending follow-ups, mention them naturally in your greeting.
- When the user completes a follow-up, use the complete_follow_up tool to mark it done.

RESEARCH DELEGATION:
- For complex research, analysis, or comparison tasks that go beyond simple calendar/email lookups, use the delegate_to_research_agent tool.
- This delegates to a background AI agent that can provide comprehensive analysis.
- Tell the user you're delegating the research, then present the findings when they come back.
- Examples: "Research the pros and cons of agile vs waterfall", "Analyze the key trends in AI for 2026", "Compare different approaches to team productivity".

WEATHER:
- You have a get_weather tool that fetches real-time weather from Open-Meteo.
- ONLY use it when the user explicitly mentions "weather" in their request. Do NOT call it for calendar queries, emails, greetings, or general questions.
- Default city is London.
- Present weather naturally: "It's currently 15 degrees and partly cloudy in London."

MORNING BRIEFING:
- When the user asks for a morning briefing, cover: calendar (use get_calendar_events for today's events), important emails (use get_recent_emails with filter="isRead eq false" for unread), and pending follow-ups (list_follow_ups).
- Only include weather if the user specifically asks for it.
- Present each section conversationally without being asked for each one.`;

/**
 * Build the proactive greeting event to send on session start.
 */
export function buildGreetingEvent() {
  const followUpSummary = getFollowUpSummary();
  const followUpContext = followUpSummary
    ? ` Also briefly mention that they have pending follow-ups: ${followUpSummary}`
    : '';

  return {
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: `Greet the user warmly. Introduce yourself as Aria, their AI executive assistant. Let them know you can help with their calendar, emails, meetings, tasks, and research. Keep it brief and friendly.${followUpContext}`,
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
