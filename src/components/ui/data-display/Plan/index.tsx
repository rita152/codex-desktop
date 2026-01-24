import { memo } from 'react';
import { cn } from '../../../../utils/cn';
import { CheckIcon, ClockIcon, CloseIcon, TerminalIcon } from '../Icon';
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

const PlanStepItem = memo(({ step }: { step: PlanStep }) => {
    return (
        <div
            className={cn('plan__step', step.status === 'active' && 'plan__step--active')}
            role="listitem"
            aria-current={step.status === 'active' ? 'step' : undefined}
        >
            <div className="plan__step-icon-wrapper">
                <StepIcon status={step.status} />
            </div>
            <div className="plan__step-content">
                <div className="plan__step-title">{step.title}</div>
                {step.description && (
                    <div className="plan__step-description">{step.description}</div>
                )}
            </div>
        </div>
    );
});

PlanStepItem.displayName = 'PlanStepItem';

export function Plan({ steps = [], title, className = '' }: PlanProps) {
    return (
        <div className={cn('plan', className)}>
            {title && <div className="plan__header">{title}</div>}
            <div className="plan__steps" role="list">
                {steps.map((step) => (
                    <PlanStepItem key={step.id} step={step} />
                ))}
            </div>
        </div>
    );
}

export type { PlanProps, PlanStep, PlanStatus } from './types';
