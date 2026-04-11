/**
 * Direct Graph API calendar service.
 * Calls /me/calendarView with the OBO token, returning clean compact data
 * instead of the verbose MCP ListCalendarView output (~24K tokens).
 * Typical latency: ~2-3s vs ~19s via copilot_chat.
 */

interface CalendarEvent {
  subject: string;
  start: string;
  end: string;
  location: string;
  organizer: string;
  isAllDay: boolean;
  onlineMeetingUrl?: string;
}

interface CalendarResult {
  events: CalendarEvent[];
  count: number;
  dateRange: string;
  error?: string;
}

/**
 * Fetch calendar events from Graph API /me/calendarView.
 * Returns a clean, compact array of events suitable for voice responses.
 *
 * @param oboToken - OBO token with Graph Calendar.Read scope
 * @param startDate - ISO date string for range start (defaults to today)
 * @param endDate - ISO date string for range end (defaults to +7 days)
 * @param maxResults - Max events to return (default 15)
 */
export async function getCalendarEvents(
  oboToken: string,
  startDate?: string,
  endDate?: string,
  maxResults: number = 15,
): Promise<CalendarResult> {
  const now = new Date();
  const start = startDate || now.toISOString();
  const end = endDate || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const graphUrl = `https://graph.microsoft.com/v1.0/me/calendarView`
    + `?startDateTime=${encodeURIComponent(start)}`
    + `&endDateTime=${encodeURIComponent(end)}`
    + `&$select=subject,start,end,location,organizer,isAllDay,onlineMeeting`
    + `&$orderby=start/dateTime`
    + `&$top=${maxResults}`;

  const timer = performance.now();

  try {
    const res = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${oboToken}`,
        'Prefer': 'outlook.timezone="UTC"',
      },
    });

    const durationMs = Math.round(performance.now() - timer);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Calendar] Graph API error: ${res.status} (${durationMs}ms) — ${errText.substring(0, 300)}`);
      return {
        events: [],
        count: 0,
        dateRange: `${start} to ${end}`,
        error: `Graph API returned ${res.status}: ${errText.substring(0, 200)}`,
      };
    }

    const data = await res.json() as {
      value: Array<{
        subject?: string;
        start?: { dateTime?: string; timeZone?: string };
        end?: { dateTime?: string; timeZone?: string };
        location?: { displayName?: string };
        organizer?: { emailAddress?: { name?: string; address?: string } };
        isAllDay?: boolean;
        onlineMeeting?: { joinUrl?: string };
      }>;
    };

    const events: CalendarEvent[] = (data.value || []).map(e => ({
      subject: e.subject || 'No subject',
      start: e.start?.dateTime || '',
      end: e.end?.dateTime || '',
      location: e.location?.displayName || '',
      organizer: e.organizer?.emailAddress?.name || e.organizer?.emailAddress?.address || '',
      isAllDay: e.isAllDay || false,
      onlineMeetingUrl: e.onlineMeeting?.joinUrl,
    }));

    console.log(`[Calendar] Fetched ${events.length} events (${durationMs}ms) — ${start.substring(0, 10)} to ${end.substring(0, 10)}`);

    return {
      events,
      count: events.length,
      dateRange: `${start} to ${end}`,
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - timer);
    console.error(`[Calendar] Fetch failed (${durationMs}ms):`, err);
    return {
      events: [],
      count: 0,
      dateRange: `${start} to ${end}`,
      error: (err as Error).message,
    };
  }
}

/**
 * Check if there are meetings starting within the next N minutes.
 * Returns only imminent meetings for proactive countdown alerts.
 */
export async function getUpcomingMeetings(
  oboToken: string,
  withinMinutes: number = 10,
): Promise<CalendarEvent[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinMinutes * 60 * 1000);

  const result = await getCalendarEvents(oboToken, now.toISOString(), cutoff.toISOString(), 5);
  return result.events.filter(e => !e.isAllDay);
}
