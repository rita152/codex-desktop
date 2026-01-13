import type { MessageRole, ThinkingData } from '../ChatMessage/types';
import type { ToolCallProps } from '../../ui/feedback/ToolCall';

export interface Message {
  /** 消息唯一标识 */
  id: string | number;
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
  /** 思考数据（assistant/thought） */
  thinking?: ThinkingData;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 工具调用 */
  toolCalls?: ToolCallProps[];
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
