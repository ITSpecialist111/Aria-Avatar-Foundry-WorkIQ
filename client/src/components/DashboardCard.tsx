import { Calendar, Mail, CheckSquare, Info, Zap, Cloud, ExternalLink } from 'lucide-react';
import type { DashboardCard as DashboardCardType, DashboardCardType as CardType } from '../types';

const CARD_CONFIG: Record<CardType, {
  icon: React.ElementType;
  bg: string;
  border: string;
  text: string;
  accent: string;
  accentBg: string;
}> = {
  calendar: {
    icon: Calendar,
    bg: 'bg-blue-500/[0.06]',
    border: 'border-blue-500/20',
    text: 'text-blue-300',
    accent: 'text-blue-400',
    accentBg: 'bg-blue-400',
  },
  email: {
    icon: Mail,
    bg: 'bg-emerald-500/[0.06]',
    border: 'border-emerald-500/20',
    text: 'text-emerald-300',
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-400',
  },
  task: {
    icon: CheckSquare,
    bg: 'bg-orange-500/[0.06]',
    border: 'border-orange-500/20',
    text: 'text-orange-300',
    accent: 'text-orange-400',
    accentBg: 'bg-orange-400',
  },
  action: {
    icon: Zap,
    bg: 'bg-purple-500/[0.06]',
    border: 'border-purple-500/20',
    text: 'text-purple-300',
    accent: 'text-purple-400',
    accentBg: 'bg-purple-400',
  },
  info: {
    icon: Info,
    bg: 'bg-slate-500/[0.06]',
    border: 'border-slate-500/20',
    text: 'text-slate-300',
    accent: 'text-slate-400',
    accentBg: 'bg-slate-400',
  },
  weather: {
    icon: Cloud,
    bg: 'bg-sky-500/[0.06]',
    border: 'border-sky-500/20',
    text: 'text-sky-300',
    accent: 'text-sky-400',
    accentBg: 'bg-sky-400',
  },
  link: {
    icon: ExternalLink,
    bg: 'bg-indigo-500/[0.06]',
    border: 'border-indigo-500/20',
    text: 'text-indigo-300',
    accent: 'text-indigo-400',
    accentBg: 'bg-indigo-400',
  },
};

function formatRelativeTime(timestamp: number): string {
  const delta = Math.floor((Date.now() - timestamp) / 1000);
  if (delta < 5) return 'just now';
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

/** SVG checkmark that draws itself */
function AnimatedCheckmark() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 10l4 4 8-8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-400"
        style={{
          strokeDasharray: 20,
          strokeDashoffset: 20,
          animation: 'checkmark-draw 0.4s ease-out 0.2s forwards',
        }}
      />
    </svg>
  );
}

interface DashboardCardProps {
  card: DashboardCardType;
  index?: number;
}

export function DashboardCard({ card, index = 0 }: DashboardCardProps) {
  const config = CARD_CONFIG[card.type] || CARD_CONFIG.info;
  const Icon = config.icon;

  return (
    <div
      className={`${config.bg} ${config.border} border rounded-xl p-3 backdrop-blur-sm animate-card-enter`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Header: icon + title */}
      <div className="flex items-center gap-2 mb-1.5">
        {card.type === 'action' ? (
          <AnimatedCheckmark />
        ) : (
          <Icon className={`w-4 h-4 shrink-0 ${config.accent}`} />
        )}
        <span className={`text-sm font-medium ${config.text} truncate`}>
          {card.title}
        </span>
      </div>

      {/* Rich content based on card type */}
      {card.type === 'calendar' && card.items && card.items.length > 0 ? (
        /* Mini horizontal timeline */
        <div className="ml-6 space-y-1">
          {card.items.slice(0, 4).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${config.accentBg} shrink-0`} />
              <span className="text-[11px] text-slate-400 shrink-0 w-14 font-mono">{item.value}</span>
              <span className="text-[11px] text-slate-300 truncate">{item.label}</span>
            </div>
          ))}
          {card.items.length > 4 && (
            <span className="text-[10px] text-slate-600 ml-3.5">+{card.items.length - 4} more</span>
          )}
        </div>
      ) : card.type === 'email' && card.items && card.items.length > 0 ? (
        /* Sender initial circles */
        <div className="ml-6 space-y-1.5">
          {card.items.slice(0, 4).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full ${config.bg} border ${config.border} flex items-center justify-center shrink-0`}>
                <span className="text-[9px] font-bold text-emerald-300">
                  {item.label.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-[11px] text-slate-300 truncate">{item.label}</span>
            </div>
          ))}
        </div>
      ) : card.type === 'weather' ? (
        /* Weather with gradient */
        <div className="ml-6">
          <p className="text-xs text-slate-300 leading-relaxed">{card.content}</p>
        </div>
      ) : (
        /* Default content */
        <>
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 ml-6">
            {card.content}
          </p>
          {card.items && card.items.length > 0 && (
            <div className="mt-2 ml-6 space-y-0.5">
              {card.items.map((item, idx) => (
                <div key={idx} className="flex gap-1.5 text-xs">
                  <span className="text-slate-500 shrink-0">{item.label}:</span>
                  <span className="text-slate-300 truncate">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Optional link */}
      {card.linkUrl && (
        <div className="mt-2 ml-6">
          <a
            href={card.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs ${config.accent} hover:underline flex items-center gap-1`}
          >
            <ExternalLink className="w-3 h-3" />
            {card.linkLabel || 'Open'}
          </a>
        </div>
      )}

      {/* Timestamp */}
      <div className="mt-2 ml-6">
        <span className="text-[10px] text-slate-600">{formatRelativeTime(card.timestamp)}</span>
      </div>
    </div>
  );
}
