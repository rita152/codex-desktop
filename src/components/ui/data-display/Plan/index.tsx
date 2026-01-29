import { memo, useState, useMemo } from 'react';
import { cn } from '../../../../utils/cn';
import { CheckIcon, ClockIcon, CloseIcon, TerminalIcon, ChevronDownIcon, ChevronUpIcon } from '../Icon';
import type { PlanProps, PlanStep, PlanStatus } from './types';
import './Plan.css';

const StepIcon = memo(({ status }: { status: PlanStatus }) => {
  switch (status) {
    case 'completed':
      return <CheckIcon size={16} className="plan__step-icon plan__step-icon--completed" />;
    case 'error':
      return <CloseIcon size={16} className="plan__step-icon plan__step-icon--error" />;
    case 'active':
      return <TerminalIcon size={16} className="plan__step-icon plan__step-icon--active" />;
    case 'pending':
    default:
      return <ClockIcon size={16} className="plan__step-icon plan__step-icon--pending" />;
  }
});

StepIcon.displayName = 'StepIcon';

const PlanStepItem = memo(({ step, className }: { step: PlanStep; className?: string }) => {
  return (
    <div
      className={cn(
        'plan__step',
        step.status === 'active' && 'plan__step--active',
        className
      )}
      role="listitem"
      aria-current={step.status === 'active' ? 'step' : undefined}
    >
      <div className="plan__step-icon-wrapper">
        <StepIcon status={step.status} />
      </div>
      <div className="plan__step-content">
        <div className="plan__step-title">{step.title}</div>
        {step.description && <div className="plan__step-description">{step.description}</div>}
      </div>
    </div>
  );
});

PlanStepItem.displayName = 'PlanStepItem';

export function Plan({ steps = [], title, className = '' }: PlanProps) {
  // Default to expanded, consistent with user expectation of visibility
  const [isCollapsed, setIsCollapsed] = useState(false);

  const activeStep = useMemo(() => {
    // Find the current active step, or the first pending, or the last completed one
    return (
      steps.find((s) => s.status === 'active') ||
      steps.find((s) => s.status === 'pending') ||
      (steps.length > 0 ? steps[steps.length - 1] : undefined)
    );
  }, [steps]);

  // If no steps, render nothing (should be handled by parent, but safe to handle here)
  if (!steps || steps.length === 0) return null;

  return (
    <div
      className={cn(
        'plan',
        isCollapsed && 'plan--collapsed',
        className
      )}
    >
      <div className="plan__controls">
        <button
          className="plan__toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand plan' : 'Collapse plan'}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
        </button>
      </div>

      {isCollapsed ? (
        // Collapsed View: Only show active step
        <div className="plan__collapsed-content">
          {activeStep && <PlanStepItem step={activeStep} className="plan__step--collapsed-view" />}
        </div>
      ) : (
        // Expanded View: Title + List
        <>
          {title && <div className="plan__header">{title}</div>}
          <div className="plan__steps" role="list">
            {steps.map((step) => (
              <PlanStepItem key={step.id} step={step} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export type { PlanProps, PlanStep, PlanStatus } from './types';
