import { useState } from 'react';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';
import type { DashboardCard as DashboardCardType } from '../types';
import { DashboardCard } from './DashboardCard';

interface DashboardPanelProps {
  cards: DashboardCardType[];
}

export function DashboardPanel({ cards }: DashboardPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Don't render at all if no cards
  if (cards.length === 0) return null;

  // Show up to 5 most recent cards, sorted newest first
  const visibleCards = [...cards]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  return (
    <div className="border-b border-slate-800">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Activity
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-brand-600/30 text-brand-300 rounded-full">
            {cards.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {/* Collapsible card list with smooth height transition */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-3 space-y-2">
          {visibleCards.map(card => (
            <DashboardCard key={card.id} card={card} />
          ))}
        </div>
      </div>
    </div>
  );
}
