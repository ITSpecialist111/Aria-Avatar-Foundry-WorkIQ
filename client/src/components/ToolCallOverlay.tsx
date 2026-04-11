import { Check, Loader2 } from 'lucide-react';
import type { WorkflowStep } from '../hooks/useVoiceLive';

interface ToolCallOverlayProps {
  workflowSteps: WorkflowStep[];
  isToolCallActive: boolean;
}

export function ToolCallOverlay({ workflowSteps, isToolCallActive }: ToolCallOverlayProps) {
  const activeStep = workflowSteps.find(s => s.status === 'running');
  const completedCount = workflowSteps.filter(s => s.status === 'completed').length;
  const showOverlay = isToolCallActive || activeStep;

  // Get display name — prettify tool names
  const toolDisplayName = activeStep?.toolName
    ? activeStep.toolName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
    : 'Processing...';

  return (
    <div
      className={`tool-overlay ${showOverlay ? 'active' : ''}`}
      style={{ zIndex: 20 }}
    >
      <div className="tool-overlay-bar">
        {/* Shimmer effect */}
        {isToolCallActive && <div className="tool-shimmer" />}

        {/* Spinner or checkmark */}
        <div className="relative z-10 shrink-0">
          {isToolCallActive ? (
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
          ) : completedCount > 0 ? (
            <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="w-3 h-3 text-emerald-400" />
            </div>
          ) : null}
        </div>

        {/* Tool name */}
        <span className="relative z-10 text-xs text-slate-300 truncate">
          {isToolCallActive ? toolDisplayName : completedCount > 0 ? `${completedCount} tool${completedCount > 1 ? 's' : ''} completed` : ''}
        </span>

        {/* Step progress dots */}
        {workflowSteps.length > 1 && (
          <div className="relative z-10 flex items-center gap-1 ml-auto">
            {workflowSteps.map((step, i) => (
              <div key={i} className="flex items-center">
                <div
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    step.status === 'completed'
                      ? 'bg-emerald-400 animate-step-complete'
                      : step.status === 'running'
                        ? 'bg-amber-400 animate-pulse'
                        : step.status === 'failed'
                          ? 'bg-red-400'
                          : 'bg-slate-600'
                  }`}
                />
                {i < workflowSteps.length - 1 && (
                  <div className={`w-3 h-px mx-0.5 ${
                    step.status === 'completed' ? 'bg-emerald-400/50' : 'bg-slate-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
