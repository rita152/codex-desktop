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
  width?: number;
  onWidthChange?: (width: number) => void;
  className?: string;
}
