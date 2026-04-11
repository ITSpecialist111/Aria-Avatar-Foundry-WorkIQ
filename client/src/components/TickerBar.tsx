import { useState, useEffect } from 'react';
import { Cloud, Mail, Calendar, ExternalLink, Clock, Timer } from 'lucide-react';
import type { TickerData, TranscriptEntry } from '../types';

interface TickerBarProps {
  transcript: TranscriptEntry[];
  sessionActive: boolean;
}

const WORD_TO_NUM: Record<string, string> = {
  no: '0', zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
};

function wordToDigit(word: string): string {
  return WORD_TO_NUM[word.toLowerCase()] ?? word;
}

/** Extract calendar/meeting info from transcript using broad patterns */
function extractMeetingSummary(transcript: TranscriptEntry[]): string | null {
  const assistantMessages = transcript
    .filter(t => t.role === 'assistant' && !t.isInterim)
    .map(t => t.content);

  for (let i = assistantMessages.length - 1; i >= Math.max(0, assistantMessages.length - 8); i--) {
    const msg = assistantMessages[i]?.toLowerCase() || '';

    const meetingMatch = msg.match(/(\d+|no|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+(meeting|appointment|event|call|sync|standup)/i);
    if (meetingMatch) {
      const n = wordToDigit(meetingMatch[1]!);
      return `${n} ${meetingMatch[2]}${n === '1' ? '' : 's'}`;
    }

    const calMatch = msg.match(/(\d+|no|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+(things?|items?|entries?|events?)\s+(on|in)\s+(your|the)\s+calendar/i);
    if (calMatch) {
      const n = wordToDigit(calMatch[1]!);
      return `${n} calendar item${n === '1' ? '' : 's'}`;
    }

    if (msg.includes('calendar') || msg.includes('schedule')) {
      const timeSlots = msg.match(/\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)/gi);
      if (timeSlots && timeSlots.length >= 2) {
        const count = Math.ceil(timeSlots.length / 2);
        return `~${count} calendar items`;
      }
    }
  }
  return null;
}

/** Extract email info from transcript using broad patterns */
function extractEmailSummary(transcript: TranscriptEntry[]): string | null {
  const assistantMessages = transcript
    .filter(t => t.role === 'assistant' && !t.isInterim)
    .map(t => t.content);

  for (let i = assistantMessages.length - 1; i >= Math.max(0, assistantMessages.length - 8); i--) {
    const msg = assistantMessages[i]?.toLowerCase() || '';

    const emailMatch = msg.match(/(\d+|no|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+(new |unread |recent |important |urgent )?(email|message|mail)/i);
    if (emailMatch) {
      const n = wordToDigit(emailMatch[1]!);
      const qualifier = emailMatch[2]?.trim() || '';
      const noun = emailMatch[3] === 'mail' ? 'email' : emailMatch[3]!;
      return `${n} ${qualifier ? qualifier + ' ' : ''}${noun}${n === '1' ? '' : 's'}`.replace(/\s+/g, ' ');
    }

    if ((msg.includes('email') || msg.includes('inbox') || msg.includes('mail')) && msg.includes('from ')) {
      const fromCount = (msg.match(/from /g) || []).length;
      if (fromCount >= 1) {
        return `${fromCount} email${fromCount === 1 ? '' : 's'} discussed`;
      }
    }
  }
  return null;
}

/** Format meeting countdown */
function formatCountdown(nextMeetingTime: string | null): string | null {
  if (!nextMeetingTime) return null;
  const diff = new Date(nextMeetingTime).getTime() - Date.now();
  if (diff < 0 || diff > 24 * 60 * 60 * 1000) return null;

  const totalSec = Math.floor(diff / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/** Real-time clock that updates every second */
function useCurrentTime() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(timer);
  }, []);

  return now;
}

export function TickerBar({ transcript, sessionActive }: TickerBarProps) {
  const [ticker, setTicker] = useState<TickerData & { nextMeetingTime?: string; nextMeetingName?: string } | null>(null);
  const now = useCurrentTime();

  // Fetch ticker data on mount and every 15 minutes
  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const res = await fetch('/api/ticker');
        if (res.ok) {
          const data = await res.json();
          setTicker(data);
        }
      } catch (_e) {
        // Silent fail — ticker is non-critical
      }
    };

    fetchTicker();
    const interval = setInterval(fetchTicker, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const meetingSummary = extractMeetingSummary(transcript);
  const emailSummary = extractEmailSummary(transcript);
  const countdown = formatCountdown(ticker?.nextMeetingTime || null);

  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-slate-900/60 backdrop-blur-xl border-b border-white/[0.04] text-xs overflow-hidden">
      {/* Date & Time */}
      <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
        <Clock className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-slate-300">{dateStr}</span>
        <span className="text-slate-300 font-mono tabular-nums">{timeStr}</span>
      </div>

      <div className="w-px h-3 bg-gradient-to-b from-transparent via-slate-700 to-transparent shrink-0" />

      {/* Weather */}
      {ticker?.weather && (
        <>
          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-300">
              {ticker.weather.icon} {ticker.weather.temperature}°C
            </span>
            <span className="text-slate-500">{ticker.weather.condition}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500">{ticker.weather.location}</span>
          </div>
          <div className="w-px h-3 bg-gradient-to-b from-transparent via-slate-700 to-transparent shrink-0" />
        </>
      )}

      {/* Next meeting countdown */}
      {countdown && ticker?.nextMeetingName && (
        <>
          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
            <Timer className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300 font-medium">{ticker.nextMeetingName}</span>
            <span className="text-amber-400/80 font-mono tabular-nums">in {countdown}</span>
          </div>
          <div className="w-px h-3 bg-gradient-to-b from-transparent via-slate-700 to-transparent shrink-0" />
        </>
      )}

      {/* Meetings from transcript */}
      {meetingSummary && (
        <>
          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-300">{meetingSummary}</span>
          </div>
          <div className="w-px h-3 bg-gradient-to-b from-transparent via-slate-700 to-transparent shrink-0" />
        </>
      )}

      {/* Emails from transcript */}
      {emailSummary && (
        <>
          <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
            <Mail className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">{emailSummary}</span>
          </div>
          <div className="w-px h-3 bg-gradient-to-b from-transparent via-slate-700 to-transparent shrink-0" />
        </>
      )}

      {/* Session status — animated radio wave */}
      {sessionActive && (
        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
          <div className="relative w-3.5 h-3.5 flex items-center justify-center">
            <div className="absolute w-2 h-2 bg-emerald-400 rounded-full" />
            <div className="absolute w-3 h-3 border border-emerald-400/40 rounded-full animate-radio-wave" />
            <div className="absolute w-3 h-3 border border-emerald-400/20 rounded-full animate-radio-wave" style={{ animationDelay: '0.5s' }} />
          </div>
          <span className="text-emerald-400 font-medium">Live</span>
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
