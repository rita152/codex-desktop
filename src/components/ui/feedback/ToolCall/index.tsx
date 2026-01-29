import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../../utils/cn';
import { formatDurationShort } from '../../../../i18n/format';

import {
  AlertCircleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  FileIcon,
  LoaderIcon,
  ToolIcon,
} from './icons';

import type { ToolCallProps, ToolCallStatus, ToolCallLocation } from './types';

import './ToolCall.css';

// ============ Helpers ============

function getStatusIcon(status: ToolCallStatus, size = 16) {
  switch (status) {
    case 'pending':
      return <ToolIcon size={size} />;
    case 'in-progress':
      return <LoaderIcon size={size} />;
    case 'completed':
      return <CheckCircleIcon size={size} />;
    case 'failed':
      return <AlertCircleIcon size={size} />;
  }
}

function getStatusLabel(status: ToolCallStatus, t: (key: string) => string): string {
  switch (status) {
    case 'pending':
      return t('toolCall.status.pending');
    case 'in-progress':
      return t('toolCall.status.inProgress');
    case 'completed':
      return t('toolCall.status.completed');
    case 'failed':
      return t('toolCall.status.failed');
  }
}

function formatJson(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function getFileName(uri: string): string {
  const parts = uri.split('/');
  return parts[parts.length - 1] || uri;
}

function formatLocation(location: ToolCallLocation): string {
  const fileName = getFileName(location.uri);
  if (location.range) {
    const { startLine, endLine } = location.range;
    if (endLine && endLine !== startLine) {
      return `${fileName}:${startLine}-${endLine}`;
    }
    return `${fileName}:${startLine}`;
  }
  return fileName;
}

function formatLocationKey(location: ToolCallLocation): string {
  const range = location.range;
  if (!range) return location.uri;
  const startColumn = range.startColumn ?? '';
  const endLine = range.endLine ?? '';
  const endColumn = range.endColumn ?? '';
  return `${location.uri}:${range.startLine}:${startColumn}-${endLine}:${endColumn}`;
}

// ============ Main Component ============

export const ToolCall = memo(function ToolCall({
  toolCallId,
  title,
  variant = 'card',
  status,
  locations,
  rawOutput,
  startTime,
  duration,
  defaultOpen,
  className = '',
}: ToolCallProps) {
  const { t } = useTranslation();
  const hasContent = rawOutput !== undefined && rawOutput !== null;

  const isActive = status === 'in-progress';

  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);

  const [elapsedTime, setElapsedTime] = useState(0);

  const formattedOutput = useMemo(() => {
    if (!isOpen || rawOutput === undefined || rawOutput === null) return null;
    return formatJson(rawOutput);
  }, [isOpen, rawOutput]);

  // 实时计时 - 使用 500ms 间隔减少不必要的更新
  useEffect(() => {
    if (!isActive || !startTime) {
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
    if (status === 'in-progress' && startTime) {
      return formatDurationShort(t, elapsedTime);
    }
    if ((status === 'completed' || status === 'failed') && duration !== undefined) {
      return formatDurationShort(t, duration);
    }
    return null;
  })();

  const statusIcon = useMemo(() => getStatusIcon(status, 14), [status]);
  const statusLabel = getStatusLabel(status, t);

  const canToggle = hasContent;

  const classNames = cn(
    'tool-call',
    variant === 'embedded' && 'tool-call--embedded',
    isOpen && 'tool-call--open',
    `tool-call--${status}`,
    className
  );

  return (
    <div className={classNames} data-tool-call-id={toolCallId}>
      <button
        type="button"
        className="tool-call__trigger"
        onClick={() => canToggle && setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        disabled={!canToggle}
      >
        <span className="tool-call__title">
          <span className="tool-call__title-text" title={title}>
            {title}
          </span>
          {locations && locations.length > 0 && (
            <span className="tool-call__locations">
              {locations.map((loc) => (
                <span key={formatLocationKey(loc)} className="tool-call__location" title={loc.uri}>
                  <FileIcon size={12} />
                  <span>{formatLocation(loc)}</span>
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="tool-call__icon tool-call__icon--status">{statusIcon}</span>
        <span className={cn('tool-call__status', `tool-call__status--${status}`)}>
          {statusLabel}
        </span>
        {showDuration && <span className="tool-call__duration">{showDuration}</span>}
        {hasContent && (
          <span className="tool-call__chevron">
            <ChevronDownIcon size={14} />
          </span>
        )}
      </button>

      {hasContent && (
        <div className="tool-call__content">
          <div className="tool-call__content-inner">
            {/* 原始输出 */}
            {rawOutput !== undefined && rawOutput !== null && (
              <div className="tool-call__section">
                <span className="tool-call__section-label">{t('toolCall.output')}</span>
                <pre className="tool-call__code">{formattedOutput}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

ToolCall.displayName = 'ToolCall';

export type {
  ToolCallProps,
  ToolCallStatus,
  ToolKind,
  ToolCallContent,
  ToolCallLocation,
  LocationRange,
  TextContent,
  DiffContent,
  TerminalContent,
} from './types';
