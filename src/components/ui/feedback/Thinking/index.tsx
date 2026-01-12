import { useState, useEffect, useRef } from 'react';

import { Markdown } from '../../data-display/Markdown';
import { cn } from '../../../../utils/cn';

import type { ThinkingProps } from './types';

import './Thinking.css';
export { ThinkingLoading } from './ThinkingLoading';

function useTypewriterText(targetText: string, enabled: boolean) {
  const [displayText, setDisplayText] = useState(targetText);
  const displayTextRef = useRef(displayText);
  const targetTextRef = useRef(targetText);
  const rafIdRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    displayTextRef.current = displayText;
  }, [displayText]);

  useEffect(() => {
    targetTextRef.current = targetText;
  }, [targetText]);

  useEffect(() => {
    if (!enabled) {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      lastTsRef.current = null;
      setDisplayText(targetText);
      return;
    }

    if (displayTextRef.current.length > targetText.length) {
      setDisplayText(targetText);
    }

    const speedCharsPerSecond = 140;
    const maxCharsPerFrame = 14;

    const tick = (ts: number) => {
      const lastTs = lastTsRef.current ?? ts;
      const dt = ts - lastTs;
      lastTsRef.current = ts;

      const current = displayTextRef.current;
      const target = targetTextRef.current;

      if (current.length >= target.length) {
        rafIdRef.current = null;
        return;
      }

      const remaining = target.length - current.length;
      const ideal = Math.floor((dt * speedCharsPerSecond) / 1000);
      const toAdd = Math.min(remaining, Math.max(1, Math.min(maxCharsPerFrame, ideal)));

      const next = target.slice(0, current.length + toAdd);
      displayTextRef.current = next;
      setDisplayText(next);

      rafIdRef.current = requestAnimationFrame(tick);
    };

    if (rafIdRef.current === null) {
      lastTsRef.current = null;
      rafIdRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      lastTsRef.current = null;
    };
  }, [enabled, targetText]);

  return displayText;
}

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
  isStreaming = false,
  startTime,
  duration,
  defaultOpen,
  className = '',
}: ThinkingProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? isStreaming);
  const [elapsedTime, setElapsedTime] = useState(0);
  const prevIsStreamingRef = useRef(isStreaming);
  const streamedContent = useTypewriterText(content, isStreaming);

  // 思考中：默认展开；思考结束：默认折叠（用户仍可手动切换）
  useEffect(() => {
    const prev = prevIsStreamingRef.current;
    if (!prev && isStreaming) {
      setIsOpen(true);
    }
    if (prev && !isStreaming) {
      setIsOpen(false);
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // 实时计时
  useEffect(() => {
    if (!isStreaming || !startTime) {
      setElapsedTime(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedTime((Date.now() - startTime) / 1000);
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 100);

    return () => clearInterval(timer);
  }, [isStreaming, startTime]);

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

  const getLabel = (): string => {
    if (isStreaming) {
      if (startTime) {
        return `思考中... ${formatDuration(elapsedTime)}`;
      }
      return '思考中...';
    }
    if (duration !== undefined) {
      return `思考了 ${formatDuration(duration)}`;
    }
    return '思考过程';
  };

  const classNames = cn(
    'thinking',
    isOpen && 'thinking--open',
    isStreaming && 'thinking--streaming',
    className
  );

  return (
    <div className={classNames}>
      <button
        type="button"
        className="thinking__trigger"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <span className="thinking__icon">
          <BrainIcon size={16} />
        </span>
        <span className="thinking__label">{getLabel()}</span>
        <span className="thinking__chevron">
          <ChevronDownIcon size={14} />
        </span>
      </button>
      <div className="thinking__content">
        <div className="thinking__content-inner">
          <Markdown
            content={isStreaming ? streamedContent : content}
            compact={!isStreaming}
            className="thinking__text"
          />
        </div>
      </div>
    </div>
  );
}

export type { ThinkingProps } from './types';
