import type { ThinkingPhase } from './thinking';

import type { ToolCallProps } from '../components/ui/feedback/ToolCall';
import type { PlanStep } from './plan';

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

export interface Message {
  /** 消息唯一标识 */
  id: string | number;
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
  /** 思考数据（assistant/thought） */
  thinking?: ThinkingData;
  /** 执行计划步骤 */
  planSteps?: PlanStep[];
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 工具调用 */
  toolCalls?: ToolCallProps[];
  /** 时间戳 */
  timestamp?: Date;
}
