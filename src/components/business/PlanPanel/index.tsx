import { memo, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../utils/cn';
import { CloseIcon } from '../../ui/data-display/Icon';
import { IconButton } from '../../ui/data-entry/IconButton';
import type { PlanStep, PlanStatus } from '../../../types/plan';

import './PlanPanel.css';

export interface PlanPanelProps {
  /** Plan steps */
  steps: PlanStep[];
  /** Optional explanation text */
  explanation?: string;
  /** Whether the panel is visible */
  visible: boolean;
  /** Callback when user manually closes the panel */
  onClose?: () => void;
  /** Custom class name */
  className?: string;
}

// TUI-style checkbox icons
function CheckboxIcon({ status }: { status: PlanStatus }) {
  switch (status) {
    case 'completed':
      return <span className="plan-panel__checkbox plan-panel__checkbox--completed">✓</span>;
    case 'error':
      return <span className="plan-panel__checkbox plan-panel__checkbox--error">✗</span>;
    case 'active':
      return <span className="plan-panel__checkbox plan-panel__checkbox--active">□</span>;
    case 'pending':
    default:
      return <span className="plan-panel__checkbox plan-panel__checkbox--pending">□</span>;
  }
}

const PlanStepItem = memo(({ step }: { step: PlanStep }) => {
  const isCompleted = step.status === 'completed';
  const isActive = step.status === 'active';
  const isError = step.status === 'error';

  return (
    <div
      className={cn(
        'plan-panel__step',
        isActive && 'plan-panel__step--active',
        isCompleted && 'plan-panel__step--completed',
        isError && 'plan-panel__step--error'
      )}
    >
      <CheckboxIcon status={step.status} />
      <span
        className={cn('plan-panel__step-text', isCompleted && 'plan-panel__step-text--completed')}
      >
        {step.title}
      </span>
    </div>
  );
});

PlanStepItem.displayName = 'PlanStepItem';

export const PlanPanel = memo(function PlanPanel({
  steps,
  explanation,
  visible,
  onClose,
  className = '',
}: PlanPanelProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  // Calculate progress
  const { completed, total } = useMemo(() => {
    let completedCount = 0;
    for (const step of steps) {
      if (step.status === 'completed') completedCount++;
    }
    return { completed: completedCount, total: steps.length };
  }, [steps]);

  // Auto-scroll to active step
  useEffect(() => {
    if (!visible || !panelRef.current) return;
    const activeElement = panelRef.current.querySelector('.plan-panel__step--active');
    if (activeElement) {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [visible, steps]);

  const progressText = t('plan.progress', {
    completed,
    total,
    defaultValue: `${completed}/${total}`,
  });

  return (
    <div
      ref={panelRef}
      className={cn('plan-panel', visible && 'plan-panel--visible', className)}
      role="region"
      aria-label={t('plan.title', { defaultValue: 'Plan' })}
      aria-hidden={!visible}
    >
      {/* Header */}
      <div className="plan-panel__header">
        <span className="plan-panel__icon">📋</span>
        <span className="plan-panel__title">{t('plan.title', { defaultValue: 'Plan' })}</span>
        <span className="plan-panel__progress">{progressText}</span>
        <IconButton
          icon={<CloseIcon size={12} />}
          size="sm"
          variant="ghost"
          onClick={onClose}
          aria-label={t('common.close', { defaultValue: 'Close' })}
          className="plan-panel__close"
        />
      </div>

      {/* Content */}
      <div className="plan-panel__content">
        {/* Explanation */}
        {explanation && <div className="plan-panel__explanation">{explanation}</div>}

        {/* Steps */}
        <div className="plan-panel__steps">
          {steps.map((step) => (
            <PlanStepItem key={step.id} step={step} />
          ))}
        </div>
      </div>
    </div>
  );
});

PlanPanel.displayName = 'PlanPanel';
