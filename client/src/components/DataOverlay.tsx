import { useState, useEffect, useRef } from 'react';
import { Calendar, Mail, Cloud } from 'lucide-react';
import type { DashboardCard } from '../types';

interface DataOverlayProps {
  dashboardCards: DashboardCard[];
}

/** Track which card IDs we've already shown */
function useShownCards() {
  const shownRef = useRef<Set<string>>(new Set());
  return shownRef.current;
}

interface OverlayEntry {
  card: DashboardCard;
  expiresAt: number;
  fading: boolean;
}

export function DataOverlay({ dashboardCards }: DataOverlayProps) {
  const [overlays, setOverlays] = useState<OverlayEntry[]>([]);
  const shownCards = useShownCards();

  // Watch for new dashboard cards and create overlay entries
  useEffect(() => {
    const newCards = dashboardCards.filter(
      c => !shownCards.has(c.id) && ['calendar', 'email', 'weather'].includes(c.type)
    );

    if (newCards.length === 0) return;

    newCards.forEach(c => shownCards.add(c.id));

    setOverlays(prev => [
      ...prev,
      ...newCards.map(card => ({
        card,
        expiresAt: Date.now() + 10000, // show for 10s
        fading: false,
      })),
    ]);
  }, [dashboardCards, shownCards]);

  // Fade out and remove expired overlays
  useEffect(() => {
    if (overlays.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setOverlays(prev => {
        const updated = prev.map(o => {
          if (!o.fading && now >= o.expiresAt - 500) {
            return { ...o, fading: true };
          }
          return o;
        });
        return updated.filter(o => now < o.expiresAt);
      });
    }, 200);

    return () => clearInterval(interval);
  }, [overlays.length]);

  if (overlays.length === 0) return null;

  // Only show the most recent overlay
  const latest = overlays[overlays.length - 1]!;
  const { card, fading } = latest;

  const Icon = card.type === 'calendar' ? Calendar
    : card.type === 'email' ? Mail
    : Cloud;

  const accentColor = card.type === 'calendar' ? 'text-blue-400'
    : card.type === 'email' ? 'text-emerald-400'
    : 'text-sky-400';

  const borderColor = card.type === 'calendar' ? 'border-blue-500/20'
    : card.type === 'email' ? 'border-emerald-500/20'
    : 'border-sky-500/20';

  return (
    <div
      className={`data-overlay ${fading ? 'fading' : ''}`}
      style={{ zIndex: 10 }}
    >
      <div className={`data-overlay-card ${borderColor}`}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`w-4 h-4 ${accentColor}`} />
          <span className="text-xs font-medium text-slate-200">{card.title}</span>
        </div>

        {/* Items list */}
        {card.items && card.items.length > 0 ? (
          <div className="space-y-1.5 max-h-[160px] overflow-hidden">
            {card.items.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${accentColor.replace('text-', 'bg-')}`} />
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-300 block truncate">{item.label}</span>
                  {item.value && (
                    <span className="text-[10px] text-slate-500 block truncate">{item.value}</span>
                  )}
                </div>
              </div>
            ))}
            {card.items.length > 5 && (
              <span className="text-[10px] text-slate-500">+{card.items.length - 5} more</span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
            {card.content}
          </p>
        )}
      </div>
    </div>
  );
}
