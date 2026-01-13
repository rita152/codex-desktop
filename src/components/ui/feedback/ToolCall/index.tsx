import { useState, useEffect } from 'react';

import { cn } from '../../../../utils/cn';
import { GitDiff } from '../../data-display/GitDiff';

import type {
  ToolCallProps,
  ToolCallStatus,
  ToolKind,
  ToolCallLocation,
} from './types';

import './ToolCall.css';

// ============ Icons ============

function ToolIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function LoaderIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckCircleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertCircleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ChevronDownIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function FileIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

// ============ Kind Icons ============

function ReadIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EditIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function ExecuteIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function FetchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function BrowserIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

function McpIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

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

export function ToolCall({
  toolCallId,
  title,
  kind,
  status,
  content,
  locations,
  rawInput,
  rawOutput,
  error,
  startTime,
  duration,
  defaultOpen,
  className = '',
}: ToolCallProps) {
  const hasContent =
    rawInput !== undefined ||
    rawOutput !== undefined ||
    Boolean(error) ||
    (content && content.length > 0);

  const isActive = status === 'in-progress';

  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);

  const [elapsedTime, setElapsedTime] = useState(0);

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
          {title}
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
            {/* 原始输入 */}
            {rawInput !== undefined && rawInput !== null && (
              <div className="tool-call__section">
                <span className="tool-call__section-label">Input</span>
                <pre className="tool-call__code">{formatJson(rawInput)}</pre>
              </div>
            )}

            {/* 内容块 */}
            {content && content.length > 0 && (
              <div className="tool-call__section">
                <span className="tool-call__section-label">Output</span>
                {content.map((item, idx) => {
                  if (item.type === 'text') {
                    return (
                      <pre key={idx} className="tool-call__code">
                        {item.text}
                      </pre>
                    );
                  }
                  if (item.type === 'diff') {
                    return (
                      <div key={idx} className="tool-call__diff">
                        <GitDiff diff={item.diff} fileName={item.path} />
                      </div>
                    );
                  }
                  if (item.type === 'terminal') {
                    return (
                      <div key={idx} className="tool-call__terminal">
                        <div className="tool-call__terminal-header">
                          <span>Terminal: {item.terminalId}</span>
                          {item.cwd && (
                            <span className="tool-call__terminal-meta">cwd: {item.cwd}</span>
                          )}
                          {item.exitCode !== undefined && item.exitCode !== null && (
                            <span className="tool-call__terminal-meta">exit {item.exitCode}</span>
                          )}
                          {item.signal && (
                            <span className="tool-call__terminal-meta">signal {item.signal}</span>
                          )}
                        </div>
                        <pre className="tool-call__terminal-output">
                          {item.output?.length ? item.output : '等待终端输出...'}
                        </pre>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}

            {/* 原始输出 */}
            {rawOutput !== undefined && rawOutput !== null && (
              <div className="tool-call__section">
                <span className="tool-call__section-label">Output</span>
                <pre className="tool-call__code">{formatJson(rawOutput)}</pre>
              </div>
            )}

            {/* 错误信息 */}
            {error && (
              <div className="tool-call__section">
                <span className="tool-call__section-label">Error</span>
                <p className="tool-call__error">{error}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
