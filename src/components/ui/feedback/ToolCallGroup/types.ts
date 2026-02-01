import type { ToolCallProps, ToolCallStatus } from '../ToolCall';

export interface ToolCallGroupProps {
  /** Unique identifier for the group */
  groupId: string;
  /** List of tool calls in this group */
  toolCalls: ToolCallProps[];
  /** Display variant */
  variant?: 'card' | 'embedded';
  /** Whether expanded by default */
  defaultOpen?: boolean;
  /** Custom class name */
  className?: string;
}

export interface ToolCallGroupSummary {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  pending: number;
  status: ToolCallStatus;
}
