import type { ToolCallProps } from '../../ui/feedback/ToolCall';
import type { PlanStep } from '../../../types/plan';

import type { MessageRole, ThinkingData } from '../../../types/message';

export type { MessageRole, ThinkingData } from '../../../types/message';

export interface ChatMessageProps {
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
  /** 思考数据（assistant/thought 角色） */
  thinking?: ThinkingData;
  /** 执行计划步骤 */
  planSteps?: PlanStep[];
  /** 工具调用卡片（仅 tool 角色） */
  toolCalls?: ToolCallProps[];
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 时间戳 */
  timestamp?: Date;
  /** 自定义类名 */
  className?: string;
}
