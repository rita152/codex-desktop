import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../../utils/cn';
import { Markdown } from '../../data-display/Markdown';
import { formatDurationLong } from '../../../../i18n/format';

import type { ThinkingProps } from './types';

import './Thinking.css';

function BrainIcon({ size = 16 }: { size?: number }) {
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
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}

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

// Extract the FIRST **bold** status header from content (TUI-inspired)
// This is displayed as the Thinking label
function extractFirstBoldHeader(raw: string): string | null {
  const match = raw.match(/\*\*([^*]+)\*\*/);
  if (match && match[1]) {
    const title = match[1].trim();
    return title.length > 0 ? title : null;
  }
  return null;
}

// Remove the leading **status header** from content for display
// Since header is shown in label, don't duplicate it in body
function removeLeadingBoldHeader(raw: string): string {
  // Remove the first **...**  pattern and any following whitespace/newlines
  return raw.replace(/^\s*\*\*[^*]+\*\*\s*/, '').trim();
}

// Fallback: extract title from # > - formats
function extractFallbackTitle(raw: string): string | null {
  const lines = raw.split('\n');
  const titleIndex = lines.findIndex((line) => line.trim().length > 0);
  if (titleIndex === -1) return null;

  const rawTitleLine = lines[titleIndex] ?? '';
  const titleLine = rawTitleLine.trim();

  const headingMatch = titleLine.match(/^#{1,6}\s+(.+)$/);
  if (headingMatch) return headingMatch[1]?.trim() ?? null;

  const quoteMatch = titleLine.match(/^>\s*(.+)$/);
  if (quoteMatch) return quoteMatch[1]?.trim() ?? null;

  const bulletMatch = titleLine.match(/^[-*]\s+(.+)$/);
  if (bulletMatch) return bulletMatch[1]?.trim() ?? null;

  return null;
}

export function Thinking({
  content,
  title,
  variant = 'card',
  headerVariant = 'default',
  isStreaming = false,
  phase = 'done',
  startTime,
  duration,
  defaultOpen,
  hideWorkingLabel = false,
  className = '',
}: ThinkingProps) {
  const { t } = useTranslation();
  const isActive = phase === 'working' || phase === 'thinking';

  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer for elapsed time
  useEffect(() => {
    if (!isActive || !startTime) {
      setElapsedTime(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedTime((Date.now() - startTime) / 1000);
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 100);

    return () => clearInterval(timer);
  }, [isActive, startTime]);

  // Extract current status header: prefer **bold**, fallback to # > -
  const extractedTitle = extractFirstBoldHeader(content) ?? extractFallbackTitle(content);

  // Remove the header from display content (since it's shown in the label)
  const displayContent = extractFirstBoldHeader(content)
    ? removeLeadingBoldHeader(content)
    : content;

  const getLabel = (): string => {
    // When we have an extracted status header, show it with duration info
    if (extractedTitle) {
      if (phase === 'working') return extractedTitle;
      if (phase === 'thinking') {
        if (startTime) return `${extractedTitle} · ${formatDurationLong(t, elapsedTime)}`;
        return extractedTitle;
      }
      // phase === 'done'
      if (duration !== undefined) return `${extractedTitle} · ${formatDurationLong(t, duration)}`;
      return extractedTitle;
    }

    // Fallback to generic labels
    if (phase === 'working') return t('thinking.label.working');
    if (phase === 'thinking') {
      if (startTime) {
        return t('thinking.label.thinkingWithDuration', {
          duration: formatDurationLong(t, elapsedTime),
        });
      }
      return t('thinking.label.thinking');
    }
    if (duration !== undefined) {
      return t('thinking.label.doneWithDuration', { duration: formatDurationLong(t, duration) });
    }
    return t('thinking.label.title');
  };

  const labelMarkdown =
    headerVariant === 'title' ? (title ?? extractedTitle ?? t('thinking.label.title')) : getLabel();
  const hasBodyContent = displayContent.trim().length > 0;
  const shouldHideHeader = hideWorkingLabel && phase === 'working' && headerVariant !== 'title';
  const isExpanded = shouldHideHeader ? true : isOpen;

  const classNames = cn(
    'thinking',
    variant === 'embedded' && 'thinking--embedded',
    isExpanded && 'thinking--open',
    isActive && 'thinking--streaming',
    phase === 'working' && 'thinking--working',
    phase === 'thinking' && 'thinking--thinking',
    className
  );

  if (shouldHideHeader && !hasBodyContent) {
    return null;
  }

  return (
    <div className={classNames}>
      {!shouldHideHeader && (
        <button
          type="button"
          className="thinking__trigger"
          onClick={() => hasBodyContent && setIsOpen((v) => !v)}
          aria-expanded={isExpanded}
          disabled={!hasBodyContent}
        >
          {headerVariant !== 'title' && (
            <span className="thinking__icon">
              <BrainIcon size={16} />
            </span>
          )}
          <div className="thinking__label">
            {headerVariant === 'title' ? (
              <Markdown content={labelMarkdown} compact className="thinking__label-markdown" />
            ) : (
              labelMarkdown
            )}
          </div>
          {hasBodyContent && (
            <>
              <span className="thinking__chevron">
                <ChevronDownIcon size={14} />
              </span>
              <span className="thinking__spacer" />
            </>
          )}
        </button>
      )}
      {hasBodyContent && (
        <div className="thinking__content">
          <div className="thinking__content-inner">
            <Markdown content={displayContent} compact={!isStreaming} className="thinking__text" />
          </div>
        </div>
      )}
    </div>
  );
}

export type { ThinkingProps, ThinkingPhase } from './types';
