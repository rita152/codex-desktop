import type { ApprovalProps } from '../../ui/feedback/Approval';
import type { Message } from '../../../types/message';

export type { Message } from '../../../types/message';

export interface ChatMessageListProps {
  /** 消息列表 */
  messages: Message[];
  /** 待审批列表 */
  approvals?: ApprovalProps[];
  /** 是否正在生成 */
  isGenerating?: boolean;
  /** 是否自动滚动到底部 */
  autoScroll?: boolean;
  /** 自定义类名 */
  className?: string;
}
