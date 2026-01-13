import { cn } from '../../../../utils/cn';

import type {
  ApprovalProps,
  ApprovalStatus,
  ApprovalType,
  PermissionOption,
  PermissionOptionKind,
} from './types';

import './Approval.css';

// ============ Icons ============

function ClockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CheckDoubleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 6 9 17 4 12" />
      <polyline points="22 10 13 21 11 19" />
    </svg>
  );
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ============ Default Options ============

const EXEC_OPTIONS: PermissionOption[] = [
  { id: 'approved-for-session', label: 'Always', kind: 'allow-always' },
  { id: 'approved', label: 'Yes', kind: 'allow-once' },
  { id: 'abort', label: 'No', kind: 'reject-once' },
];

const PATCH_OPTIONS: PermissionOption[] = [
  { id: 'approved', label: 'Yes', kind: 'allow-once' },
  { id: 'abort', label: 'No', kind: 'reject-once' },
];

function getDefaultOptions(type: ApprovalType): PermissionOption[] {
  return type === 'exec' ? EXEC_OPTIONS : PATCH_OPTIONS;
}

// ============ Helpers ============

function getStatusIcon(status: ApprovalStatus, size = 14) {
  switch (status) {
    case 'pending':
      return <ClockIcon size={size} />;
    case 'approved':
      return <CheckIcon size={size} />;
    case 'approved-for-session':
      return <CheckDoubleIcon size={size} />;
    case 'rejected':
      return <XIcon size={size} />;
  }
}

function getStatusLabel(status: ApprovalStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'approved':
      return 'Approved';
    case 'approved-for-session':
      return 'Always Approved';
    case 'rejected':
      return 'Rejected';
  }
}

function getOptionIcon(kind: PermissionOptionKind, size = 14) {
  switch (kind) {
    case 'allow-always':
      return <CheckDoubleIcon size={size} />;
    case 'allow-once':
      return <CheckIcon size={size} />;
    case 'reject-once':
      return <XIcon size={size} />;
  }
}

// ============ Main Component ============

export function Approval({
  callId,
  type,
  title,
  status,
  options,
  disabled = false,
  loading = false,
  onSelect,
  className = '',
}: ApprovalProps) {
  const isPending = status === 'pending';
  const resolvedOptions = options ?? getDefaultOptions(type);
  const showActions = isPending && onSelect && resolvedOptions.length > 0;

  const classNames = cn(
    'approval',
    `approval--${status}`,
    `approval--${type}`,
    disabled && 'approval--disabled',
    className
  );

  const handleSelect = (optionId: string) => {
    if (!disabled && !loading && onSelect) {
      onSelect(callId, optionId);
    }
  };

  return (
    <div className={classNames} data-call-id={callId}>
      <div className="approval__header">
        <span className="approval__icon">
          {getStatusIcon(status, 16)}
        </span>
        <span className="approval__title">{title}</span>
        <span className={`approval__status approval__status--${status}`}>
          {getStatusLabel(status)}
        </span>
        {showActions && (
          <div className="approval__actions">
            {resolvedOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  'approval__btn',
                  `approval__btn--${option.kind}`,
                  loading && 'approval__btn--loading'
                )}
                onClick={() => handleSelect(option.id)}
                disabled={disabled || loading}
              >
                {getOptionIcon(option.kind, 12)}
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type {
  ApprovalProps,
  ApprovalStatus,
  ApprovalType,
  PermissionOption,
  PermissionOptionKind,
} from './types';
