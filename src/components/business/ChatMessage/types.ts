import type { ReactNode } from 'react';

export type MessageRole = 'user' | 'assistant';

export interface ThinkingData {
  /** 思考内容 */
  content: string;
  /** 是否正在流式传输 */
  isStreaming?: boolean;
  /** 思考开始时间戳 */
  startTime?: number;
  /** 最终思考时长（秒） */
  duration?: number;
}

export interface ChatMessageProps {
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: ReactNode;
  /** 思考数据（仅 assistant 角色） */
  thinking?: ThinkingData;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 时间戳 */
  timestamp?: Date;
  /** 自定义类名 */
  className?: string;
}
