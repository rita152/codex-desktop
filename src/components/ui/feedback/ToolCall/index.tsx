import { memo, useEffect, useMemo, useState } from 'react';

import { cn } from '../../../../utils/cn';

import {
  AlertCircleIcon,
  BrowserIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  EditIcon,
  ExecuteIcon,
  FetchIcon,
  FileIcon,
  LoaderIcon,
  McpIcon,
  ReadIcon,
  SearchIcon,
  ToolIcon,
} from './icons';

import type {
  ToolCallProps,
  ToolCallStatus,
  ToolKind,
  ToolCallLocation,
} from './types';

import './ToolCall.css';

// ============ Helpers ============

function getKindIcon(kind: ToolKind | undefined, size = 16) {
  switch (kind) {
    case 'read':
      return <ReadIcon size={size} />;
    case 'edit':
      return <EditIcon size={size} />;
    case 'execute':
      return <ExecuteIcon size={size} />;
    case 'search':
      return <SearchIcon size={size} />;
    case 'fetch':
      return <FetchIcon size={size} />;
    case 'browser':
      return <BrowserIcon size={size} />;
    case 'mcp':
      return <McpIcon size={size} />;
    default:
      return <ToolIcon size={size} />;
  }
}

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

function getStatusLabel(status: ToolCallStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in-progress':
      return 'Running';
    case 'completed':
      return 'Done';
    case 'failed':
      return 'Failed';
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`;
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
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

// ============ Main Component ============

export const ToolCall = memo(function ToolCall({
  toolCallId,
  title,
  kind,
  status,
  locations,
  rawOutput,
  startTime,
  duration,
  defaultOpen,
  className = '',
}: ToolCallProps) {
  const hasContent = rawOutput !== undefined && rawOutput !== null;

  const isActive = status === 'in-progress';

  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);

  const [elapsedTime, setElapsedTime] = useState(0);

  const formattedOutput = useMemo(() => {
    if (!isOpen || rawOutput === undefined || rawOutput === null) return null;
    return formatJson(rawOutput);
  }, [isOpen, rawOutput]);

  // 实时计时
  useEffect(() => {
    if (!isActive || !startTime) {
      return;
    }

    const updateElapsed = () => {
      setElapsedTime((Date.now() - startTime) / 1000);
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 100);

    return () => clearInterval(timer);
  }, [isActive, startTime]);

  const showDuration =
    status === 'in-progress' && startTime
      ? formatDuration(elapsedTime)
      : (status === 'completed' || status === 'failed') && duration !== undefined
        ? formatDuration(duration)
        : null;

  const canToggle = hasContent;

  const classNames = cn(
    'tool-call',
    isOpen && 'tool-call--open',
    `tool-call--${status}`,
    kind && `tool-call--kind-${kind}`,
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
        <span className="tool-call__icon tool-call__icon--kind">
          {getKindIcon(kind, 16)}
        </span>
        <span className="tool-call__title">
          <span className="tool-call__title-text" title={title}>
            {title}
          </span>
          {locations && locations.length > 0 && (
            <span className="tool-call__locations">
              {locations.map((loc, idx) => (
                <span key={idx} className="tool-call__location" title={loc.uri}>
                  <FileIcon size={12} />
                  <span>{formatLocation(loc)}</span>
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="tool-call__icon tool-call__icon--status">
          {getStatusIcon(status, 14)}
        </span>
        <span className={`tool-call__status tool-call__status--${status}`}>
          {getStatusLabel(status)}
        </span>
        {showDuration && (
          <span className="tool-call__duration">{showDuration}</span>
        )}
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
                <span className="tool-call__section-label">Output</span>
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
