import type { ThinkingProps } from '../Thinking';
import type { ToolCallProps } from '../ToolCall';
import type { ApprovalProps } from '../Approval';

export type WorkingItem =
  | { type: 'thinking'; data: ThinkingProps }
  | { type: 'toolcall'; data: ToolCallProps }
  | { type: 'approval'; data: ApprovalProps };

export interface WorkingProps {
  /** 子项列表 */
  items: WorkingItem[];
  /** 计时开始时间（毫秒） */
  startTime?: number;
  /** 是否展开 */
  isOpen?: boolean;
  /** 是否正在进行中 */
  isActive?: boolean;
  /** 展开/折叠回调 */
  onToggle?: () => void;
  /** 自定义类名 */
  className?: string;
}
