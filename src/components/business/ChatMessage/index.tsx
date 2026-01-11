import { useEffect, useRef, useState } from 'react';

import { Thinking } from '../../ui/feedback/Thinking';
import { Markdown } from '../../ui/data-display/Markdown';
import { cn } from '../../../utils/cn';

import type { ChatMessageProps } from './types';

import './ChatMessage.css';

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

    const speedCharsPerSecond = 120;
    const maxCharsPerFrame = 12;

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

export function ChatMessage({
  role,
  content,
  thinking,
  isStreaming = false,
  timestamp,
  className = '',
}: ChatMessageProps) {
  const streamedContent = useTypewriterText(content, role === 'assistant' && isStreaming);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const classNames = cn(
    'chat-message',
    `chat-message--${role}`,
    isStreaming && 'chat-message--streaming',
    className
  );

  const renderContent = () => {
    if (role === 'assistant') {
      if (isStreaming) {
        return <div className="chat-message__streaming-text">{streamedContent}</div>;
      }
      return <Markdown content={content} />;
    }
    return content;
  };

  return (
    <div className={classNames}>
      {thinking && role === 'assistant' && (
        <div className="chat-message__thinking">
          <Thinking
            content={thinking.content}
            isStreaming={thinking.isStreaming}
            startTime={thinking.startTime}
            duration={thinking.duration}
          />
        </div>
      )}
      <div className="chat-message__bubble">{renderContent()}</div>
      {timestamp && (
        <span className="chat-message__timestamp">{formatTime(timestamp)}</span>
      )}
    </div>
  );
}

export type { ChatMessageProps, MessageRole, ThinkingData } from './types';
