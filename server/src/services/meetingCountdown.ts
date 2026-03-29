import { WebSocket } from 'ws';

interface MeetingInfo {
  title: string;
  startTime: Date;
  attendees?: string;
}

interface CountdownSession {
  timer: NodeJS.Timeout | null;
  pollTimer: NodeJS.Timeout | null;
  voiceLiveWs: WebSocket;
  nextMeeting: MeetingInfo | null;
}

const activeSessions = new Map<WebSocket, CountdownSession>();

/**
 * Start monitoring for upcoming meetings.
 * After the session is configured, we inject a system message asking copilot about
 * the next meeting, then parse the response to set up a countdown timer.
 */
export function startMeetingCountdown(voiceLiveWs: WebSocket): void {
  // Create session entry
  const session: CountdownSession = {
    timer: null,
    pollTimer: null,
    voiceLiveWs,
    nextMeeting: null,
  };
  activeSessions.set(voiceLiveWs, session);

  // Delay first check by 120s to let the greeting + any auto-launched
  // tool calls (weather, calendar) finish before injecting a new response
  session.timer = setTimeout(() => {
    pollNextMeeting(session);
    session.pollTimer = setInterval(() => pollNextMeeting(session), 10 * 60 * 1000);
  }, 120 * 1000);
}

/**
 * Ask copilot for the next meeting and set up a reminder timer.
 */
function pollNextMeeting(session: CountdownSession): void {
  if (session.voiceLiveWs.readyState !== WebSocket.OPEN) return;

  // We can't directly call MCP tools from the server -- they go through the LLM.
  // Instead, we inject a system message asking Aria to proactively check
  // if there's an upcoming meeting in the next 10 minutes.
  injectMeetingCheck(session);
}

/**
 * Inject a system message asking Aria to check for upcoming meetings.
 */
function injectMeetingCheck(session: CountdownSession): void {
  if (session.voiceLiveWs.readyState !== WebSocket.OPEN) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  session.voiceLiveWs.send(JSON.stringify({
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'system',
      content: [{
        type: 'input_text',
        text: `PROACTIVE CHECK (current time: ${timeStr}): Use the copilot tool to check if the user has any meetings starting in the next 10 minutes. If yes, proactively remind them about the upcoming meeting — mention the meeting title, time, and attendees. If no meetings are coming up soon, say nothing and do not respond at all. This is a background check — only speak if there IS an upcoming meeting.`,
      }],
    },
  }));

  session.voiceLiveWs.send(JSON.stringify({ type: 'response.create' }));

  console.log(`[MeetingCountdown] Injected meeting check at ${timeStr}`);
}

/**
 * Stop monitoring and clean up timers.
 */
export function stopMeetingCountdown(voiceLiveWs: WebSocket): void {
  const session = activeSessions.get(voiceLiveWs);
  if (session) {
    if (session.timer) clearTimeout(session.timer);
    if (session.pollTimer) clearInterval(session.pollTimer);
    activeSessions.delete(voiceLiveWs);
    console.log('[MeetingCountdown] Stopped monitoring');
  }
}
