/**
 * UI Context - Manages UI-related state
 *
 * This context handles:
 * - Sidebar visibility
 * - Side panel state (visibility, active tab, width)
 * - Settings modal state
 * - Layout responsiveness
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useResponsiveVisibility } from '../hooks/useResponsiveVisibility';
import type { SidePanelTab } from '../components/business/UnifiedSidePanel';

// Constants
export const SIDEBAR_AUTO_HIDE_MAX_WIDTH = 900;
export const DEFAULT_SIDE_PANEL_WIDTH = 260;
export const MIN_SIDE_PANEL_WIDTH = 260;
export const MIN_CONVERSATION_WIDTH = 240;

// Types
interface UIContextValue {
  // Sidebar
  sidebarVisible: boolean;
  isNarrowLayout: boolean;
  toggleSidebar: () => void;

  // Side Panel
  sidePanelVisible: boolean;
  setSidePanelVisible: (visible: boolean) => void;
  activeSidePanelTab: SidePanelTab;
  setActiveSidePanelTab: (tab: SidePanelTab) => void;
  sidePanelWidth: number;
  setSidePanelWidth: (width: number) => void;

  // Settings Modal
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  // Side Action Handler
  handleSideAction: (actionId: string) => void;
  handleSidePanelClose: () => void;
  handleSidePanelTabChange: (tab: SidePanelTab) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

// Provider Component
interface UIProviderProps {
  children: ReactNode;
}

export function UIProvider({ children }: UIProviderProps) {
  // Sidebar state
  const {
    visible: sidebarVisible,
    isNarrowLayout,
    toggle: toggleSidebar,
  } = useResponsiveVisibility(SIDEBAR_AUTO_HIDE_MAX_WIDTH, true);

  // Side Panel state
  const { visible: sidePanelVisible, setVisible: setSidePanelVisible } = useResponsiveVisibility(
    SIDEBAR_AUTO_HIDE_MAX_WIDTH,
    false
  );
  const [activeSidePanelTab, setActiveSidePanelTab] = useState<SidePanelTab>('explorer');
  const [sidePanelWidth, setSidePanelWidth] = useState(DEFAULT_SIDE_PANEL_WIDTH);

  // Settings Modal state
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  // Side action handler
  const handleSideAction = useCallback(
    (actionId: string) => {
      const tabId = actionId as SidePanelTab;

      if (sidePanelVisible && activeSidePanelTab === tabId) {
        // Toggle off if clicking the same active tab
        setSidePanelVisible(false);
      } else {
        // Switch tab and ensure open
        setActiveSidePanelTab(tabId);
        setSidePanelVisible(true);
      }
    },
    [sidePanelVisible, activeSidePanelTab, setSidePanelVisible]
  );

  const handleSidePanelClose = useCallback(() => {
    setSidePanelVisible(false);
  }, [setSidePanelVisible]);

  const handleSidePanelTabChange = useCallback((tab: SidePanelTab) => {
    setActiveSidePanelTab(tab);
  }, []);

  const value = useMemo<UIContextValue>(
    () => ({
      // Sidebar
      sidebarVisible,
      isNarrowLayout,
      toggleSidebar,

      // Side Panel
      sidePanelVisible,
      setSidePanelVisible,
      activeSidePanelTab,
      setActiveSidePanelTab,
      sidePanelWidth,
      setSidePanelWidth,

      // Settings
      settingsOpen,
      openSettings,
      closeSettings,

      // Handlers
      handleSideAction,
      handleSidePanelClose,
      handleSidePanelTabChange,
    }),
    [
      sidebarVisible,
      isNarrowLayout,
      toggleSidebar,
      sidePanelVisible,
      setSidePanelVisible,
      activeSidePanelTab,
      sidePanelWidth,
      settingsOpen,
      openSettings,
      closeSettings,
      handleSideAction,
      handleSidePanelClose,
      handleSidePanelTabChange,
    ]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

// Hook to use UI Context
export function useUIContext(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUIContext must be used within a UIProvider');
  }
  return context;
}

// Export types
export type { UIContextValue };
