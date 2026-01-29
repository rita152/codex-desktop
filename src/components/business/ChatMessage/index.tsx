import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Thinking } from '../../ui/feedback/Thinking';
import { Markdown } from '../../ui/data-display/Markdown';
import { ToolCall } from '../../ui/feedback/ToolCall';
import { cn } from '../../../utils/cn';
import { useTypewriterText } from '../../../hooks/useTypewriterText';
import { PERFORMANCE } from '../../../constants/performance';

import type { ChatMessageProps } from './types';

import './ChatMessage.css';

export const ChatMessage = memo(function ChatMessage({
  role,
  content,
  thinking,
  // planSteps is no longer rendered here - it's displayed fixed above ChatInput
  toolCalls,
  isStreaming = false,
  timestamp,
  className = '',
}: ChatMessageProps) {
  const { i18n } = useTranslation();
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [i18n.language]
  );
  const streamedContent = useTypewriterText(
    content,
    role === 'assistant' && isStreaming,
    PERFORMANCE.TYPEWRITER_SPEED_CHARS_PER_SEC,
    PERFORMANCE.TYPEWRITER_MAX_CHARS_PER_FRAME
  );

  const thoughtContent =
    role === 'thought' ? (thinking?.content ?? content) : (thinking?.content ?? '');
  const thoughtPhase =
    role === 'thought'
      ? (thinking?.phase ?? (isStreaming ? 'thinking' : 'done'))
      : (thinking?.phase ?? 'done');
  const thoughtStreaming =
    role === 'thought' ? (thinking?.isStreaming ?? isStreaming) : thinking?.isStreaming;
  const hasToolCalls = Boolean(toolCalls && toolCalls.length > 0);

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
    if (hasToolCalls && toolCalls) {
      return (
        <div className="chat-message__tool-calls">
          {toolCalls.map((toolCall) => (
            <ToolCall key={toolCall.toolCallId} {...toolCall} />
          ))}
        </div>
      );
    }
    if (role === 'assistant' || role === 'tool') {
      return <Markdown content={isStreaming ? streamedContent : content} />;
    }
    if (role === 'thought') return null;
    return content;
  };

  // 显示 Thinking 组件的条件：
  // 1. assistant 消息且有 thinking 数据（任何阶段都显示）
  // 2. thought 角色的消息
  const showThinkingBlock = (role === 'assistant' && thinking !== undefined) || role === 'thought';
  const showBubble = role !== 'thought';

  return (
    <div className={classNames}>
      {showThinkingBlock && (
        <div className="chat-message__thinking">
          <Thinking
            content={thoughtContent}
            isStreaming={thoughtStreaming}
            phase={thoughtPhase}
            startTime={thinking?.startTime}
            duration={thinking?.duration}
          />
        </div>
      )}
      {showBubble && <div className="chat-message__bubble">{renderContent()}</div>}
      {timestamp && (role === 'user' || !isStreaming) && (
        <span className="chat-message__timestamp">{timeFormatter.format(timestamp)}</span>
      )}
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export type { ChatMessageProps, MessageRole, ThinkingData } from './types';
