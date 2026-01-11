import { Thinking } from '../../ui/feedback/Thinking';
import { Markdown } from '../../ui/data-display/Markdown';
import { cn } from '../../../utils/cn';

import type { ChatMessageProps } from './types';

import './ChatMessage.css';

export function ChatMessage({
  role,
  content,
  thinking,
  isStreaming = false,
  timestamp,
  className = '',
}: ChatMessageProps) {
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
