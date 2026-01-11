export interface ChatSession {
  id: string;
  title: string;
}

export interface SidebarProps {
  sessions: ChatSession[];
  selectedSessionId?: string;
  onSessionSelect?: (sessionId: string) => void;
  onNewChat?: () => void;
  onMenuClick?: () => void;
  onSplitViewClick?: () => void;
  onSessionDelete?: (sessionId: string) => void;
  onSessionRename?: (sessionId: string, newTitle: string) => void;
  width?: number;
  onWidthChange?: (width: number) => void;
  className?: string;
}
