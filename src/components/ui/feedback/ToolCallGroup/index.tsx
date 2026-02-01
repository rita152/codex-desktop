import { memo, useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../../utils/cn';
import { formatDurationShort } from '../../../../i18n/format';
import { ToolCall } from '../ToolCall';

import type { ToolCallGroupProps, ToolCallGroupSummary } from './types';
import type { ToolCallStatus } from '../ToolCall';

import './ToolCallGroup.css';

// ============ Icons ============

function ChevronDownIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LoaderIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckCircleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function AlertCircleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function LayersIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

// ============ Helpers ============

function computeSummary(toolCalls: ToolCallGroupProps['toolCalls']): ToolCallGroupSummary {
  let completed = 0;
  let failed = 0;
  let inProgress = 0;
  let pending = 0;

  for (const tc of toolCalls) {
    switch (tc.status) {
      case 'completed':
        completed++;
        break;
      case 'failed':
        failed++;
        break;
      case 'in-progress':
        inProgress++;
        break;
      case 'pending':
        pending++;
        break;
    }
  }

  // Determine overall status
  let status: ToolCallStatus = 'completed';
  if (inProgress > 0 || pending > 0) {
    status = 'in-progress';
  } else if (failed > 0 && completed === 0) {
    status = 'failed';
  } else if (failed > 0) {
    status = 'completed'; // partial success
  }

  return {
    total: toolCalls.length,
    completed,
    failed,
    inProgress,
    pending,
    status,
  };
}

function getStatusIcon(status: ToolCallStatus, size = 14) {
  switch (status) {
    case 'pending':
      return <LayersIcon size={size} />;
    case 'in-progress':
      return <LoaderIcon size={size} />;
    case 'completed':
      return <CheckCircleIcon size={size} />;
    case 'failed':
      return <AlertCircleIcon size={size} />;
  }
}

function computeTotalDuration(toolCalls: ToolCallGroupProps['toolCalls']): number | null {
  let minStart: number | null = null;
  let maxEnd: number | null = null;

  for (const tc of toolCalls) {
    if (tc.startTime !== undefined) {
      if (minStart === null || tc.startTime < minStart) {
        minStart = tc.startTime;
      }
      if (tc.duration !== undefined) {
        const endTime = tc.startTime + tc.duration * 1000;
        if (maxEnd === null || endTime > maxEnd) {
          maxEnd = endTime;
        }
      }
    }
  }

  if (minStart !== null && maxEnd !== null) {
    return (maxEnd - minStart) / 1000;
  }
  return null;
}

function getEarliestStartTime(toolCalls: ToolCallGroupProps['toolCalls']): number | null {
  let minStart: number | null = null;
  for (const tc of toolCalls) {
    if (tc.startTime !== undefined) {
      if (minStart === null || tc.startTime < minStart) {
        minStart = tc.startTime;
      }
    }
  }
  return minStart;
}

// ============ Main Component ============

export const ToolCallGroup = memo(function ToolCallGroup({
  groupId,
  toolCalls,
  variant = 'embedded',
  defaultOpen = false,
  className = '',
}: ToolCallGroupProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [elapsedTime, setElapsedTime] = useState(0);

  const summary = useMemo(() => computeSummary(toolCalls), [toolCalls]);
  const totalDuration = useMemo(() => computeTotalDuration(toolCalls), [toolCalls]);
  const startTime = useMemo(() => getEarliestStartTime(toolCalls), [toolCalls]);

  const isActive = summary.status === 'in-progress';

  // Real-time elapsed time for in-progress groups
  useEffect(() => {
    if (!isActive || startTime === null) {
      return;
    }

    const updateElapsed = () => {
      setElapsedTime((Date.now() - startTime) / 1000);
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 500);

    return () => clearInterval(timer);
  }, [isActive, startTime]);

  const showDuration = (() => {
    if (isActive && startTime !== null) {
      return formatDurationShort(t, elapsedTime);
    }
    if (totalDuration !== null) {
      return formatDurationShort(t, totalDuration);
    }
    return null;
  })();

  const statusIcon = useMemo(() => getStatusIcon(summary.status, 14), [summary.status]);

  const statusLabel = useMemo(() => {
    if (summary.status === 'in-progress') {
      const running = summary.inProgress + summary.pending;
      return t('toolCallGroup.running', {
        count: running,
        total: summary.total,
        defaultValue: `${running}/${summary.total} running`,
      });
    }
    if (summary.failed > 0) {
      return t('toolCallGroup.partialFailed', {
        failed: summary.failed,
        total: summary.total,
        defaultValue: `${summary.failed}/${summary.total} failed`,
      });
    }
    return t('toolCallGroup.completed', {
      count: summary.total,
      defaultValue: `${summary.total} completed`,
    });
  }, [summary, t]);

  const classNames = cn(
    'tool-call-group',
    variant === 'embedded' && 'tool-call-group--embedded',
    isOpen && 'tool-call-group--open',
    `tool-call-group--${summary.status}`,
    className
  );

  return (
    <div className={classNames} data-group-id={groupId}>
      <button
        type="button"
        className="tool-call-group__trigger"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <span className="tool-call-group__icon tool-call-group__icon--type">
          <LayersIcon size={14} />
        </span>
        <span className="tool-call-group__title">
          {t('toolCallGroup.title', {
            count: summary.total,
            defaultValue: `${summary.total} parallel commands`,
          })}
        </span>
        <span className="tool-call-group__icon tool-call-group__icon--status">{statusIcon}</span>
        <span
          className={cn('tool-call-group__status', `tool-call-group__status--${summary.status}`)}
        >
          {statusLabel}
        </span>
        {showDuration && <span className="tool-call-group__duration">{showDuration}</span>}
        <span className="tool-call-group__chevron">
          <ChevronDownIcon size={14} />
        </span>
      </button>

      <div className="tool-call-group__content">
        <div className="tool-call-group__content-inner">
          <div className="tool-call-group__items">
            {toolCalls.map((tc) => (
              <ToolCall key={tc.toolCallId} {...tc} variant="embedded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

ToolCallGroup.displayName = 'ToolCallGroup';

export type { ToolCallGroupProps, ToolCallGroupSummary } from './types';
