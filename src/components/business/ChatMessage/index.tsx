import { useEffect, useRef, useState } from 'react';

import { Thinking, ThinkingLoading } from '../../ui/feedback/Thinking';
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
  const thoughtContent = role === 'thought' ? content : (thinking?.content ?? '');
  const hasThoughtText = thoughtContent.trim().length > 0;
  const showThinkingLoading =
    role === 'assistant' && isStreaming && !hasThoughtText && content.length === 0;
  const showCursor = role === 'assistant' && isStreaming;

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const visualRole = role === 'user' ? 'user' : 'assistant';
  const classNames = cn(
    'chat-message',
    `chat-message--${visualRole}`,
    role === 'thought' && 'chat-message--thought',
    role === 'tool' && 'chat-message--tool',
    isStreaming && 'chat-message--streaming',
    className
  );

  const renderContent = () => {
    if (role === 'assistant' || role === 'tool') {
      return <Markdown content={isStreaming ? streamedContent : content} />;
    }
    if (role === 'thought') return null;
    return content;
  };

  const showThinkingBlock = role === 'assistant' || role === 'thought';
  const showBubble = role !== 'thought';
  const showThinking =
    (role === 'assistant' && hasThoughtText) || (role === 'thought' && (hasThoughtText || isStreaming));

  return (
    <div className={classNames}>
      {showThinkingBlock && showThinking && (
        <div className="chat-message__thinking">
          <Thinking
            content={thoughtContent}
            isStreaming={role === 'thought' ? isStreaming : thinking?.isStreaming}
            startTime={role === 'thought' ? undefined : thinking?.startTime}
            duration={role === 'thought' ? undefined : thinking?.duration}
          />
        </div>
      )}
      {role === 'thought' && isStreaming && !hasThoughtText && (
        <div className="chat-message__thinking">
          <ThinkingLoading />
        </div>
      )}
      {showThinkingLoading && (
        <div className="chat-message__thinking">
          <ThinkingLoading />
        </div>
      )}
      {showBubble && (
        <div className="chat-message__bubble">
          {renderContent()}
          {showCursor && <span className="chat-message__cursor" aria-hidden="true" />}
        </div>
      )}
      {timestamp && (role === 'user' || !isStreaming) && (
        <span className="chat-message__timestamp">{formatTime(timestamp)}</span>
      )}
    </div>
  );
}

export type { ChatMessageProps, MessageRole, ThinkingData } from './types';
