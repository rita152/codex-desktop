import { cn } from '../../../../utils/cn';
import { CheckIcon, ClockIcon, CloseIcon, TerminalIcon } from '../Icon';
import type { PlanProps, PlanStatus } from './types';
import './Plan.css';

export function Plan({ steps = [], title, className = '' }: PlanProps) {
    const getIcon = (status: PlanStatus) => {
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
    };

    return (
        <div className={cn('plan', className)}>
            {title && <div className="plan__header">{title}</div>}
            <div className="plan__steps">
                {steps.map((step) => (
                    <div
                        key={step.id}
                        className={cn('plan__step', step.status === 'active' && 'plan__step--active')}
                    >
                        <div className="plan__step-icon-wrapper">{getIcon(step.status)}</div>
                        <div className="plan__step-content">
                            <div className="plan__step-title">{step.title}</div>
                            {step.description && (
                                <div className="plan__step-description">{step.description}</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export type { PlanProps, PlanStep, PlanStatus } from './types';
