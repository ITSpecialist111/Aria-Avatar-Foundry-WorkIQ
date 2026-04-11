/**
 * Direct Graph API email service.
 * Calls /me/messages with the OBO token, returning clean compact data
 * instead of the verbose MCP SearchMessagesQueryParameters output.
 * Typical latency: ~2-3s vs ~5-6s via MCP with cleaner output.
 */

interface EmailMessage {
  subject: string;
  from: string;
  receivedAt: string;
  preview: string;
  isRead: boolean;
  hasAttachments: boolean;
  importance: string;
}

interface EmailResult {
  emails: EmailMessage[];
  count: number;
  query: string;
  error?: string;
  _instruction?: string;
}

/**
 * Fetch recent emails from Graph API /me/messages.
 * Returns compact data suitable for voice responses.
 *
 * @param graphToken - OBO token with Graph Mail.Read scope
 * @param count - Number of emails to return (default 10)
 * @param filter - Optional OData filter (e.g. "isRead eq false")
 * @param search - Optional search query (searches subject, body, from)
 */
export async function getRecentEmails(
  graphToken: string,
  count: number = 5,
  filter?: string,
  search?: string,
): Promise<EmailResult> {
  let graphUrl = `https://graph.microsoft.com/v1.0/me/messages`
    + `?$select=subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments,importance`
    + `&$orderby=receivedDateTime desc`
    + `&$top=${count}`;

  if (filter) {
    graphUrl += `&$filter=${encodeURIComponent(filter)}`;
  }
  if (search) {
    graphUrl += `&$search="${encodeURIComponent(search)}"`;
  }

  const queryDesc = search ? `search="${search}"` : filter ? `filter="${filter}"` : `latest ${count}`;
  const timer = performance.now();

  try {
    const res = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${graphToken}`,
        'Prefer': 'outlook.body-content-type="text"',
      },
    });

    const durationMs = Math.round(performance.now() - timer);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Email] Graph API error: ${res.status} (${durationMs}ms) — ${errText.substring(0, 300)}`);
      return {
        emails: [],
        count: 0,
        query: queryDesc,
        error: `Graph API returned ${res.status}: ${errText.substring(0, 200)}`,
      };
    }

    const data = await res.json() as {
      value: Array<{
        subject?: string;
        from?: { emailAddress?: { name?: string; address?: string } };
        receivedDateTime?: string;
        bodyPreview?: string;
        isRead?: boolean;
        hasAttachments?: boolean;
        importance?: string;
      }>;
    };

    const emails: EmailMessage[] = (data.value || []).map(e => ({
      subject: e.subject || 'No subject',
      from: e.from?.emailAddress?.name || e.from?.emailAddress?.address || 'Unknown',
      receivedAt: e.receivedDateTime || '',
      preview: (e.bodyPreview || '').substring(0, 80),
      isRead: e.isRead ?? true,
      hasAttachments: e.hasAttachments ?? false,
      importance: e.importance || 'normal',
    }));

    console.log(`[Email] Fetched ${emails.length} emails (${durationMs}ms) — ${queryDesc}`);

    return {
      emails,
      count: emails.length,
      query: queryDesc,
      _instruction: 'Summarize these emails conversationally. Mention sender and subject for each. Do NOT read JSON aloud.',
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - timer);
    console.error(`[Email] Fetch failed (${durationMs}ms):`, err);
    return {
      emails: [],
      count: 0,
      query: queryDesc,
      error: (err as Error).message,
    };
  }
}
