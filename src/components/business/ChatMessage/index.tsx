import { Thinking, ThinkingLoading } from '../../ui/feedback/Thinking';
import { Markdown } from '../../ui/data-display/Markdown';
import { cn } from '../../../utils/cn';
import { useTypewriterText } from '../../../hooks/useTypewriterText';

import type { ChatMessageProps } from './types';

import './ChatMessage.css';

const TYPEWRITER_SPEED = 120;
const TYPEWRITER_MAX_CHARS = 12;

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function ChatMessage({
  role,
  content,
  thinking,
  isStreaming = false,
  timestamp,
  className = '',
}: ChatMessageProps) {
  const streamedContent = useTypewriterText(
    content,
    role === 'assistant' && isStreaming,
    TYPEWRITER_SPEED,
    TYPEWRITER_MAX_CHARS
  );
  const thoughtContent = role === 'thought' ? content : (thinking?.content ?? '');
  const hasThoughtText = thoughtContent.trim().length > 0;
  const showThinkingLoading =
    role === 'assistant' && isStreaming && !hasThoughtText && content.length === 0;
  const showCursor = role === 'assistant' && isStreaming;

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
