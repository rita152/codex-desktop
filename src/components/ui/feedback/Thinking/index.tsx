import { useState, useEffect } from 'react';

import { cn } from '../../../../utils/cn';
import { Markdown } from '../../data-display/Markdown';

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

export function Thinking({
  content,
  title,
  headerVariant = 'default',
  isStreaming = false,
  phase = 'done',
  startTime,
  duration,
  defaultOpen,
  className = '',
}: ThinkingProps) {
  const isActive = phase === 'working' || phase === 'thinking';

  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 实时计时
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

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)} 秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return remainingSeconds > 0
      ? `${minutes} 分 ${remainingSeconds} 秒`
      : `${minutes} 分钟`;
  };

  const extractTitleAndBody = (raw: string): { title: string | null; body: string } => {
    const lines = raw.split('\n');
    const titleIndex = lines.findIndex((line) => line.trim().length > 0);
    if (titleIndex === -1) return { title: null, body: '' };

    const rawTitleLine = lines[titleIndex] ?? '';
    let titleLine = rawTitleLine.trim();

    const headingMatch = titleLine.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      titleLine = headingMatch[1]?.trim() ?? '';
    } else {
      const quoteMatch = titleLine.match(/^>\s*(.+)$/);
      if (quoteMatch) titleLine = quoteMatch[1]?.trim() ?? '';
      const bulletMatch = titleLine.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) titleLine = bulletMatch[1]?.trim() ?? '';
    }

    const remaining = lines.slice(titleIndex + 1);
    if (remaining.length > 0 && remaining[0]?.trim().length === 0) {
      remaining.shift();
    }

    return { title: titleLine.length > 0 ? titleLine : null, body: remaining.join('\n') };
  };

  const getLabel = (): string => {
    if (phase === 'working') {
      return 'Working';
    }
    if (phase === 'thinking') {
      if (startTime) {
        return `Thinking ${formatDuration(elapsedTime)}`;
      }
      return 'Thinking';
    }
    // phase === 'done'
    if (duration !== undefined) {
      return `思考了 ${formatDuration(duration)}`;
    }
    return '思考过程';
  };

  const { title: extractedTitle, body: extractedBody } = extractTitleAndBody(content);
  const labelMarkdown =
    headerVariant === 'title' ? title ?? extractedTitle ?? '思考过程' : getLabel();
  const displayContent = headerVariant === 'title' ? extractedBody : content;
  const hasBodyContent = displayContent.trim().length > 0;

  // 只有有内容时才显示展开箭头
  const showChevron = hasBodyContent;
  // 只有有内容时才可点击
  const canToggle = hasBodyContent;

  const classNames = cn(
    'thinking',
    isOpen && 'thinking--open',
    isActive && 'thinking--streaming',
    phase === 'working' && 'thinking--working',
    phase === 'thinking' && 'thinking--thinking',
    className
  );

  return (
    <div className={classNames}>
      <button
        type="button"
        className="thinking__trigger"
        onClick={() => canToggle && setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        disabled={!canToggle}
      >
        {headerVariant !== 'title' && (
          <span className="thinking__icon">
            <BrainIcon size={16} />
          </span>
        )}
        <div className="thinking__label">
          {headerVariant === 'title' ? (
            <Markdown
              content={labelMarkdown}
              compact
              className="thinking__label-markdown"
            />
          ) : (
            labelMarkdown
          )}
        </div>
        {showChevron && (
          <>
            <span className="thinking__chevron">
              <ChevronDownIcon size={14} />
            </span>
            <span className="thinking__spacer" />
          </>
        )}
      </button>
      {hasBodyContent && (
        <div className="thinking__content">
          <div className="thinking__content-inner">
            <Markdown
              content={displayContent}
              compact={!isStreaming}
              className="thinking__text"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export type { ThinkingProps, ThinkingPhase } from './types';
