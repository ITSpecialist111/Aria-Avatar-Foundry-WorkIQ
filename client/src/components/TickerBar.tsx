import { useState, useEffect } from 'react';
import { Cloud, Mail, Calendar, ExternalLink } from 'lucide-react';
import type { TickerData, TranscriptEntry } from '../types';

interface TickerBarProps {
  transcript: TranscriptEntry[];
  sessionActive: boolean;
}

/** Extract meeting count from transcript (rough heuristic from Aria's responses) */
function extractMeetingSummary(transcript: TranscriptEntry[]): string | null {
  const assistantMessages = transcript
    .filter(t => t.role === 'assistant' && !t.isInterim)
    .map(t => t.content);

  // Look for recent meeting mentions
  for (let i = assistantMessages.length - 1; i >= Math.max(0, assistantMessages.length - 5); i--) {
    const msg = assistantMessages[i]?.toLowerCase() || '';
    // Match patterns like "3 meetings", "two meetings", "no meetings"
    const match = msg.match(/(\d+|no|one|two|three|four|five|six|seven|eight|nine|ten)\s+meeting/i);
    if (match) {
      return match[0].charAt(0).toUpperCase() + match[0].slice(1) + ' today';
    }
  }
  return null;
}

function extractEmailSummary(transcript: TranscriptEntry[]): string | null {
  const assistantMessages = transcript
    .filter(t => t.role === 'assistant' && !t.isInterim)
    .map(t => t.content);

  for (let i = assistantMessages.length - 1; i >= Math.max(0, assistantMessages.length - 5); i--) {
    const msg = assistantMessages[i]?.toLowerCase() || '';
    const match = msg.match(/(\d+|no|one|two|three|four|five|six|seven|eight|nine|ten)\s+(new |unread |recent )?(email|message)/i);
    if (match) {
      return match[0].charAt(0).toUpperCase() + match[0].slice(1);
    }
  }
  return null;
}

export function TickerBar({ transcript, sessionActive }: TickerBarProps) {
  const [ticker, setTicker] = useState<TickerData | null>(null);

  // Fetch ticker data on mount and every 15 minutes
  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const res = await fetch('/api/ticker');
        if (res.ok) {
          const data = await res.json();
          setTicker(data);
        }
      } catch {
        // Silent fail — ticker is non-critical
      }
    };

    fetchTicker();
    const interval = setInterval(fetchTicker, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const meetingSummary = extractMeetingSummary(transcript);
  const emailSummary = extractEmailSummary(transcript);

  // Don't show if no data at all
  if (!ticker?.weather && !meetingSummary && !emailSummary && !sessionActive) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-slate-900/80 border-b border-slate-800/50 text-xs overflow-hidden">
      {/* Weather */}
      {ticker?.weather && (
        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
          <Cloud className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-slate-300">
            {ticker.weather.icon} {ticker.weather.temperature}°C
          </span>
          <span className="text-slate-500">{ticker.weather.condition}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-500">{ticker.weather.location}</span>
        </div>
      )}

      {/* Separator */}
      {ticker?.weather && (meetingSummary || emailSummary) && (
        <div className="w-px h-3 bg-slate-700 shrink-0" />
      )}

      {/* Meetings from transcript */}
      {meetingSummary && (
        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
          <Calendar className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-300">{meetingSummary}</span>
        </div>
      )}

      {/* Emails from transcript */}
      {emailSummary && (
        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
          <Mail className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300">{emailSummary}</span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Kanban board link */}
      <a
        href="https://apps.powerapps.com/play/e/ab762569-955e-ec43-9a92-c2bbcbec9210/app/a18a78d8-3e49-4f1b-ab4d-36e1dbc82e03"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-brand-400 hover:text-brand-300 transition-colors shrink-0"
      >
        <ExternalLink className="w-3 h-3" />
        <span>Kanban Board</span>
      </a>
    </div>
  );
}
