import type { ThinkingPhase } from '../../ui/feedback/Thinking';
import type { ToolCallProps } from '../../ui/feedback/ToolCall';
import type { PlanStep } from '../../ui/data-display/Plan/types';

export type MessageRole = 'user' | 'assistant' | 'thought' | 'tool';

export interface ThinkingData {
  /** 思考内容 */
  content: string;
  /** 是否正在流式传输 */
  isStreaming?: boolean;
  /** 当前阶段 */
  phase?: ThinkingPhase;
  /** 思考开始时间戳 */
  startTime?: number;
  /** 最终思考时长（秒） */
  duration?: number;
}

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
