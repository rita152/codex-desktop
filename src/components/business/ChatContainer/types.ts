import type { ReactNode, RefObject } from 'react';

import type { Message } from '../ChatMessageList/types';
import type { ChatSession } from '../Sidebar/types';
import type { ApprovalProps } from '../../ui/feedback/Approval';
import type { SelectOption } from '../../ui/data-entry/Select/types';
import type { ModelOption, ReasoningEffort } from '../../../types/options';
import type { SessionNotice } from '../../../hooks/useSessionMeta';
import type { QueuedMessage } from '../../../hooks/useMessageQueue';
import type { SidePanelTab } from '../UnifiedSidePanel';
import type { PlanStep } from '../../../types/plan';

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
  /** 当前执行计划步骤（固定显示在 ChatInput 上方） */
  currentPlan?: PlanStep[];
  /** 消息队列 */
  messageQueue?: QueuedMessage[];
  /** 是否有排队中的消息 */
  hasQueuedMessages?: boolean;
  /** 清空队列回调 */
  onClearQueue?: () => void;
  /** 从队列移除消息回调 */
  onRemoveFromQueue?: (messageId: string) => void;
  /** 将消息移到队首回调 */
  onMoveToTopInQueue?: (messageId: string) => void;
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
  /** 模型列表 (with reasoning effort support) */
  modelOptions?: ModelOption[];
  /** 当前选中模型 */
  selectedModel?: string;
  /** 当前选中的 reasoning effort */
  selectedEffort?: ReasoningEffort;
  /** 切换模型回调 (now includes effort) */
  onModelChange?: (model: string, effort?: ReasoningEffort) => void;
  /** Slash commands 提示 */
  slashCommands?: string[];
  /** 输入框占位文案 */
  inputPlaceholder?: string;
  /** 上传文件回调 */
  onAddClick?: () => void;
  /** 侧边快捷操作 */
  onSideAction?: (actionId: string) => void;
  /** 编辑队列消息回调 */
  onEditInQueue?: (messageId: string) => void;

  /** 统一侧边栏可见性 */
  sidePanelVisible?: boolean;
  /** 当前激活的侧边栏 Tab */
  activeSidePanelTab?: SidePanelTab;
  /** 侧边栏宽度 */
  sidePanelWidth?: number;
  /** 关闭侧边栏回调 */
  onSidePanelClose?: () => void;
  /** 侧边栏调整大小回调 */
  onSidePanelResizeStart?: (event: React.PointerEvent<HTMLDivElement>) => void;
  /** 切换侧边栏 Tab 回调 */
  onSidePanelTabChange?: (tab: SidePanelTab) => void;

  /** 终端会话 ID (still needed for TerminalPanel inside UnifiedPanel) */
  terminalId?: string | null;

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
  /**
   * Navigate to previous prompt in history (older).
   * Returns the prompt string or null.
   */
  onNavigatePreviousPrompt?: (currentValue: string) => string | null;
  /**
   * Navigate to next prompt in history (newer).
   * Returns the prompt string or null.
   */
  onNavigateNextPrompt?: () => string | null;
  /**
   * Reset prompt history navigation.
   */
  onResetPromptNavigation?: () => void;
}
