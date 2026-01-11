import type { ReactNode } from 'react';

import type { MessageRole, ThinkingData } from '../ChatMessage/types';

export interface Message {
  /** 消息唯一标识 */
  id: string | number;
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: ReactNode;
  /** 思考数据（仅 assistant） */
  thinking?: ThinkingData;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 时间戳 */
  timestamp?: Date;
}

export interface ChatMessageListProps {
  /** 消息列表 */
  messages: Message[];
  /** 是否自动滚动到底部 */
  autoScroll?: boolean;
  /** 自定义类名 */
  className?: string;
}
