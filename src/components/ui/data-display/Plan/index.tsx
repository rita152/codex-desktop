import { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../../utils/cn';
import { ChevronDownIcon } from '../Icon';
import type { PlanProps, PlanStep, PlanStatus } from './types';
import './Plan.css';

// TUI-style checkbox icons
function CheckboxIcon({ status }: { status: PlanStatus }) {
  switch (status) {
    case 'completed':
      return <span className="plan__checkbox plan__checkbox--completed">✓</span>;
    case 'error':
      return <span className="plan__checkbox plan__checkbox--error">✗</span>;
    case 'active':
      return <span className="plan__checkbox plan__checkbox--active">□</span>;
    case 'pending':
    default:
      return <span className="plan__checkbox plan__checkbox--pending">□</span>;
  }
}

const PlanStepItem = memo(({ step }: { step: PlanStep }) => {
  const isCompleted = step.status === 'completed';
  const isActive = step.status === 'active';
  const isError = step.status === 'error';

  return (
    <div
      className={cn(
        'plan__step',
        isActive && 'plan__step--active',
        isCompleted && 'plan__step--completed',
        isError && 'plan__step--error'
      )}
      role="listitem"
      aria-current={isActive ? 'step' : undefined}
    >
      <CheckboxIcon status={step.status} />
      <span className={cn('plan__step-text', isCompleted && 'plan__step-text--completed')}>
        {step.title}
      </span>
    </div>
  );
});

PlanStepItem.displayName = 'PlanStepItem';

export function Plan({ steps = [], explanation, title, className = '' }: PlanProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);

  // Calculate progress
  const { completed, total, activeStep } = useMemo(() => {
    let completedCount = 0;
    let active: PlanStep | undefined;
    for (const step of steps) {
      if (step.status === 'completed') completedCount++;
      if (step.status === 'active' && !active) active = step;
    }
    // If no active, find first pending
    if (!active) {
      active = steps.find((s) => s.status === 'pending');
    }
    return { completed: completedCount, total: steps.length, activeStep: active };
  }, [steps]);

  if (!steps || steps.length === 0) return null;

  const progressText = t('plan.progress', {
    completed,
    total,
    defaultValue: `${completed}/${total}`,
  });

  return (
    <div className={cn('plan', isOpen && 'plan--open', className)}>
      <button
        type="button"
        className="plan__trigger"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <span className="plan__icon">📋</span>
        <span className="plan__title">{title || t('plan.title', { defaultValue: 'Plan' })}</span>
        <span className="plan__progress">{progressText}</span>
        <span className="plan__chevron">
          <ChevronDownIcon size={14} />
        </span>
      </button>

      <div className="plan__content">
        <div className="plan__content-inner">
          {/* Explanation */}
          {explanation && <div className="plan__explanation">{explanation}</div>}

          {/* Steps list */}
          <div className="plan__steps" role="list">
            {steps.map((step) => (
              <PlanStepItem key={step.id} step={step} />
            ))}
          </div>

          {/* Collapsed summary when closed */}
          {!isOpen && activeStep && (
            <div className="plan__active-summary">
              <CheckboxIcon status={activeStep.status} />
              <span className="plan__active-text">{activeStep.title}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type { PlanProps, PlanStep, PlanStatus } from './types';
