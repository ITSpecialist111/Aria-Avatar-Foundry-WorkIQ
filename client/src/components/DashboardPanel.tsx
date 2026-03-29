import { useState } from 'react';
import { ChevronDown, ChevronUp, Activity, LayoutDashboard } from 'lucide-react';
import type { DashboardCard as DashboardCardType } from '../types';
import { DashboardCard } from './DashboardCard';

/** Pinned quick-access widgets that always appear at the top */
const PINNED_WIDGETS: DashboardCardType[] = [
  {
    id: 'widget-kanban',
    type: 'link',
    title: 'Agentic Kanban Board',
    content: 'Open the Work IQ agentic task board in Power Apps',
    timestamp: Date.now(),
    linkUrl: 'https://apps.powerapps.com/play/e/ab762569-955e-ec43-9a92-c2bbcbec9210/app/a18a78d8-3e49-4f1b-ab4d-36e1dbc82e03',
    linkLabel: 'Open Kanban Board',
  },
];

interface DashboardPanelProps {
  cards: DashboardCardType[];
}

export function DashboardPanel({ cards }: DashboardPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showWidgets, setShowWidgets] = useState(false);

  // Combine pinned widgets + dynamic cards, sorted newest first
  const allCards = [...PINNED_WIDGETS, ...cards];
  const dynamicCards = [...cards]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8);

  const totalCount = allCards.length;

  return (
    <div className="border-b border-slate-800">
      {/* Quick Widgets section */}
      <button
        onClick={() => setShowWidgets(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Quick Access
          </span>
        </div>
        {showWidgets ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          showWidgets ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-2 space-y-2">
          {PINNED_WIDGETS.map(card => (
            <DashboardCard key={card.id} card={card} />
          ))}
        </div>
      </div>

      {/* Activity feed - only show if we have dynamic cards */}
      {dynamicCards.length > 0 && (
        <>
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/50 transition-colors border-t border-slate-800/50"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Activity
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-brand-600/30 text-brand-300 rounded-full">
                {totalCount}
              </span>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isExpanded ? 'max-h-[600px] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="px-4 pb-3 space-y-2">
              {dynamicCards.map(card => (
                <DashboardCard key={card.id} card={card} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
