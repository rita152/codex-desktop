import { Thinking } from '../../ui/feedback/Thinking';
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
  const thoughtPhase = role === 'thought' 
    ? (isStreaming ? 'thinking' : 'done')
    : (thinking?.phase ?? 'done');
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

  // 显示 Thinking 组件的条件：
  // 1. assistant 消息且有 thinking 数据（任何阶段都显示）
  // 2. thought 角色的消息
  const showThinkingBlock = 
    (role === 'assistant' && thinking !== undefined) || 
    role === 'thought';
  const showBubble = role !== 'thought';

  return (
    <div className={classNames}>
      {showThinkingBlock && (
        <div className="chat-message__thinking">
          <Thinking
            content={thoughtContent}
            isStreaming={role === 'thought' ? isStreaming : thinking?.isStreaming}
            phase={thoughtPhase}
            startTime={role === 'thought' ? undefined : thinking?.startTime}
            duration={role === 'thought' ? undefined : thinking?.duration}
          />
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
