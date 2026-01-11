import type { ReactNode } from 'react';

import type { Message } from '../ChatMessageList/types';
import type { ChatSession } from '../Sidebar/types';

export interface ChatContainerProps {
  /** 会话列表 */
  sessions: ChatSession[];
  /** 当前选中的会话 ID */
  selectedSessionId?: string;
  /** 当前会话的消息列表 */
  messages: Message[];
  /** 是否正在生成回复 */
  isGenerating?: boolean;
  /** 会话选择回调 */
  onSessionSelect?: (sessionId: string) => void;
  /** 新建对话回调 */
  onNewChat?: () => void;
  /** 发送消息回调 */
  onSendMessage?: (message: string) => void;
  /** 停止生成回调 */
  onStopGenerate?: () => void;
  /** 删除会话回调 */
  onSessionDelete?: (sessionId: string) => void;
  /** 重命名会话回调 */
  onSessionRename?: (sessionId: string, newTitle: string) => void;
  /** 侧边栏是否显示 */
  sidebarVisible?: boolean;
  /** 侧边栏显示切换回调 */
  onSidebarToggle?: () => void;
  /** 欢迎内容（无消息时显示） */
  welcomeContent?: ReactNode;
  /** 自定义类名 */
  className?: string;
}
