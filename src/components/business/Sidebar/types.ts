import type { ChatSession } from '../../../types/session';

export type { ChatSession } from '../../../types/session';

export interface SidebarProps {
  /** Active sessions (current app session) */
  sessions: ChatSession[];
  /** History sessions (from rollout files) */
  historySessions?: ChatSession[];
  selectedSessionId?: string;
  onSessionSelect?: (sessionId: string) => void;
  onNewChat?: () => void;
  onMenuClick?: () => void;
  onSplitViewClick?: () => void;
  onSessionDelete?: (sessionId: string) => void;
  onSessionRename?: (sessionId: string, newTitle: string) => void;
  onSettingsClick?: () => void;
  width?: number;
  onWidthChange?: (width: number) => void;
  className?: string;
}
