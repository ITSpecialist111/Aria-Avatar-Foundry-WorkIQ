import { Calendar, Mail, CheckSquare, Info, Zap, Cloud, ExternalLink } from 'lucide-react';
import type { DashboardCard as DashboardCardType, DashboardCardType as CardType } from '../types';

const CARD_CONFIG: Record<CardType, {
  icon: React.ElementType;
  bg: string;
  border: string;
  text: string;
  accent: string;
}> = {
  calendar: {
    icon: Calendar,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
    accent: 'text-blue-400',
  },
  email: {
    icon: Mail,
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
    accent: 'text-emerald-400',
  },
  task: {
    icon: CheckSquare,
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-300',
    accent: 'text-orange-400',
  },
  action: {
    icon: Zap,
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-300',
    accent: 'text-purple-400',
  },
  info: {
    icon: Info,
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-300',
    accent: 'text-slate-400',
  },
  weather: {
    icon: Cloud,
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    text: 'text-sky-300',
    accent: 'text-sky-400',
  },
  link: {
    icon: ExternalLink,
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-300',
    accent: 'text-indigo-400',
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

interface DashboardCardProps {
  card: DashboardCardType;
}

export function DashboardCard({ card }: DashboardCardProps) {
  const config = CARD_CONFIG[card.type] || CARD_CONFIG.info;
  const Icon = config.icon;

  return (
    <div
      className={`${config.bg} ${config.border} border rounded-lg p-3 animate-in fade-in slide-in-from-top-2 duration-300`}
    >
      {/* Header: icon + title */}
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-4 h-4 shrink-0 ${config.accent}`} />
        <span className={`text-sm font-medium ${config.text} truncate`}>
          {card.title}
        </span>
      </div>

      {/* Content */}
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 ml-6">
        {card.content}
      </p>

      {/* Optional items as label:value pairs */}
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
