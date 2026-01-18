import type { ReactNode, RefObject } from 'react';

import type { Message } from '../ChatMessageList/types';
import type { ChatSession } from '../Sidebar/types';
import type { ApprovalProps } from '../../ui/feedback/Approval';
import type { SelectOption } from '../../ui/data-entry/Select/types';
import type { SessionNotice } from '../../../hooks/useSessionMeta';

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
  /** 会话选择回调 */
  onSessionSelect?: (sessionId: string) => void;
  /** 新建对话回调 */
  onNewChat?: () => void;
  /** 发送消息回调 */
  onSendMessage?: (message: string) => void;
  /** 选择工作目录 */
  onSelectCwd?: () => void;
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
  /** 剩余上下文百分比 */
  remainingPercent?: number;
  /** 剩余 token 数 */
  remainingTokens?: number;
  /** 总 token 数 */
  totalTokens?: number;
  /** 剩余上下文按钮点击 */
  onRemainingClick?: () => void;
  /** 剩余上下文按钮禁用 */
  remainingDisabled?: boolean;
  /** 欢迎内容（无消息时显示） */
  welcomeContent?: ReactNode;
  /** 主体容器引用 */
  bodyRef?: RefObject<HTMLDivElement>;
  /** 自定义类名 */
  className?: string;
}
