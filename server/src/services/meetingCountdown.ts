import { WebSocket } from 'ws';
import { getUpcomingMeetings } from './calendarService';

interface CountdownSession {
  timer: NodeJS.Timeout | null;
  pollTimer: NodeJS.Timeout | null;
  voiceLiveWs: WebSocket;
  graphToken: string;
}

const activeSessions = new Map<WebSocket, CountdownSession>();

/**
 * Start monitoring for upcoming meetings.
 * Uses direct Graph API calls (~2-3s) instead of routing through
 * GPT-5 → copilot_chat (~19s) for each check.
 * Only notifies Aria when there IS an upcoming meeting.
 *
 * @param voiceLiveWs - The Voice Live WebSocket connection
 * @param graphToken - Graph API OBO token with Calendars.Read scope
 */
export function startMeetingCountdown(voiceLiveWs: WebSocket, graphToken?: string): void {
  if (!graphToken) {
    console.log('[MeetingCountdown] No Graph token — skipping meeting monitoring');
    return;
  }

  const session: CountdownSession = {
    timer: null,
    pollTimer: null,
    voiceLiveWs,
    graphToken,
  };
  activeSessions.set(voiceLiveWs, session);

  // Delay first check by 120s to let the greeting + any auto-launched
  // tool calls finish before injecting a new response
  session.timer = setTimeout(() => {
    pollNextMeeting(session);
    // Check every 5 minutes (down from 10 — it's fast now)
    session.pollTimer = setInterval(() => pollNextMeeting(session), 5 * 60 * 1000);
  }, 120 * 1000);

  console.log('[MeetingCountdown] Started — first check in 120s, then every 5min');
}

/**
 * Check for upcoming meetings via direct Graph API call.
 * Only notifies Aria if there's actually a meeting within 10 minutes.
 */
async function pollNextMeeting(session: CountdownSession): Promise<void> {
  if (session.voiceLiveWs.readyState !== WebSocket.OPEN) return;

  try {
    const meetings = await getUpcomingMeetings(session.graphToken, 10);

    if (meetings.length === 0) {
      console.log('[MeetingCountdown] No upcoming meetings in next 10 minutes');
      return;
    }

    // There are upcoming meetings — notify Aria to alert the user
    const meetingSummary = meetings.map(m => {
      const startTime = new Date(m.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `"${m.subject}" at ${startTime}${m.organizer ? ` (organized by ${m.organizer})` : ''}`;
    }).join('; ');

    console.log(`[MeetingCountdown] ${meetings.length} upcoming meeting(s): ${meetingSummary}`);

    session.voiceLiveWs.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
        content: [{
          type: 'input_text',
          text: `PROACTIVE MEETING ALERT: The user has ${meetings.length === 1 ? 'a meeting' : `${meetings.length} meetings`} starting very soon: ${meetingSummary}. Briefly remind the user about this upcoming meeting — mention the title and time. Keep it to one sentence.`,
        }],
      },
    }));

    session.voiceLiveWs.send(JSON.stringify({ type: 'response.create' }));
  } catch (err) {
    console.error('[MeetingCountdown] Check failed:', (err as Error).message);
  }
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
