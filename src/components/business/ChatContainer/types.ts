import type { ReactNode, RefObject } from 'react';

import type { Message } from '../ChatMessageList/types';
import type { ChatSession } from '../Sidebar/types';
import type { ApprovalProps } from '../../ui/feedback/Approval';
import type { SelectOption } from '../../ui/data-entry/Select/types';
import type { SessionNotice } from '../../../hooks/useSessionMeta';
import type { QueuedMessage } from '../../../hooks/useMessageQueue';

export interface ChatContainerProps {
  /** 会话列表 */
  sessions: ChatSession[];
  /** 当前选中的会话 ID */
  selectedSessionId?: string;
  /** 当前会话工作目录 */
  sessionCwd?: string;
  /** 当前会话提示信息 */
  sessionNotice?: SessionNotice | null;
  /** 当前会话的消息列表 */
  messages: Message[];
  /** 待审批列表 */
  approvals?: ApprovalProps[];
  /** 是否正在生成回复 */
  isGenerating?: boolean;
  /** 消息队列 */
  messageQueue?: QueuedMessage[];
  /** 是否有排队中的消息 */
  hasQueuedMessages?: boolean;
  /** 清空队列回调 */
  onClearQueue?: () => void;
  /** 从队列移除消息回调 */
  onRemoveFromQueue?: (messageId: string) => void;
  /** 输入框内容 */
  inputValue: string;
  /** 输入框内容变更 */
  onInputChange: (value: string) => void;
  /** 模式列表 */
  agentOptions?: SelectOption[];
  /** 当前选中模式 */
  selectedAgent?: string;
  /** 切换模式回调 */
  onAgentChange?: (agent: string) => void;
  /** 模型列表 */
  modelOptions?: SelectOption[];
  /** 当前选中模型 */
  selectedModel?: string;
  /** 切换模型回调 */
  onModelChange?: (model: string) => void;
  /** Slash commands 提示 */
  slashCommands?: string[];
  /** 输入框占位文案 */
  inputPlaceholder?: string;
  /** 上传文件回调 */
  onAddClick?: () => void;
  /** 侧边快捷操作 */
  onSideAction?: (actionId: string) => void;
  /** 是否显示终端面板 */
  terminalVisible?: boolean;
  /** 终端会话 ID */
  terminalId?: string | null;
  /** 关闭终端面板 */
  onTerminalClose?: () => void;
  /** 是否显示远程服务器面板 */
  remoteServerPanelVisible?: boolean;
  /** 远程服务器面板宽度 */
  remoteServerPanelWidth?: number;
  /** 关闭远程服务器面板 */
  onRemoteServerPanelClose?: () => void;
  /** 远程服务器面板调整大小 */
  onRemoteServerPanelResizeStart?: (event: React.PointerEvent<HTMLDivElement>) => void;
  /** 是否显示文件浏览器面板 */
  fileBrowserVisible?: boolean;
  /** 文件浏览器面板宽度 */
  fileBrowserWidth?: number;
  /** 关闭文件浏览器面板 */
  onFileBrowserClose?: () => void;
  /** 文件浏览器面板调整大小 */
  onFileBrowserResizeStart?: (event: React.PointerEvent<HTMLDivElement>) => void;
  /** 文件选择回调 */
  onFileSelect?: (path: string) => void;
  /** 会话选择回调 */
  onSessionSelect?: (sessionId: string) => void;
  /** 新建对话回调 */
  onNewChat?: () => void;
  /** 发送消息回调 */
  onSendMessage?: (message: string) => void;
  /** 打开本地目录选择器 */
  onPickLocalCwd?: () => void;
  /** 直接设置工作目录 */
  onSetCwd?: (cwd: string) => void;
  /** 工作目录是否锁定（已发送过 prompt 时锁定） */
  cwdLocked?: boolean;
  /** 删除会话回调 */
  onSessionDelete?: (sessionId: string) => void;
  /** 重命名会话回调 */
  onSessionRename?: (sessionId: string, newTitle: string) => void;
  /** 侧边栏是否显示 */
  sidebarVisible?: boolean;
  /** 侧边栏显示切换回调 */
  onSidebarToggle?: () => void;
  /** 打开设置面板回调 */
  onSettingsClick?: () => void;
  /** 欢迎内容（无消息时显示） */
  welcomeContent?: ReactNode;
  /** 主体容器引用 */
  bodyRef?: RefObject<HTMLDivElement | null>;
  /** 自定义类名 */
  className?: string;
}
