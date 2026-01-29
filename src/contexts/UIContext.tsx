/**
 * UI Context - Bridge layer for UIStore
 *
 * This context now delegates to the Zustand UIStore for state management.
 * It maintains the same interface for backward compatibility while
 * benefiting from Zustand's optimized subscriptions.
 *
 * New code should prefer importing directly from '../stores':
 *   import { useUIStore, useSidebarVisible } from '../stores';
 */

import { useEffect, type ReactNode } from 'react';

import {
  useUIStore,
  SIDEBAR_AUTO_HIDE_MAX_WIDTH,
  DEFAULT_SIDE_PANEL_WIDTH,
  MIN_SIDE_PANEL_WIDTH,
  MIN_CONVERSATION_WIDTH,
} from '../stores';

import type { SidePanelTab } from '../components/business/UnifiedSidePanel';

// Re-export constants for backward compatibility
export {
  SIDEBAR_AUTO_HIDE_MAX_WIDTH,
  DEFAULT_SIDE_PANEL_WIDTH,
  MIN_SIDE_PANEL_WIDTH,
  MIN_CONVERSATION_WIDTH,
};

// Types - maintained for backward compatibility
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

// Provider Component - now just initializes the store
interface UIProviderProps {
  children: ReactNode;
}

export function UIProvider({ children }: UIProviderProps) {
  const setIsNarrowLayout = useUIStore((state) => state.setIsNarrowLayout);
  const setSidebarVisible = useUIStore((state) => state.setSidebarVisible);
  const setSidePanelVisible = useUIStore((state) => state.setSidePanelVisible);

  // Handle responsive layout changes
  useEffect(() => {
    const checkLayout = () => {
      const isNarrow = window.innerWidth < SIDEBAR_AUTO_HIDE_MAX_WIDTH;
      const wasNarrow = useUIStore.getState().isNarrowLayout;

      setIsNarrowLayout(isNarrow);

      // Auto-hide on transition to narrow layout
      if (isNarrow && !wasNarrow) {
        setSidebarVisible(false);
        setSidePanelVisible(false);
      }
      // Auto-show sidebar on transition to wide layout
      if (!isNarrow && wasNarrow) {
        setSidebarVisible(true);
      }
    };

    // Initial check
    checkLayout();

    // Listen for resize
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, [setIsNarrowLayout, setSidebarVisible, setSidePanelVisible]);

  return <>{children}</>;
}

/**
 * Hook to use UI state - now delegates to UIStore
 *
 * @deprecated Prefer using selectors from '../stores' for better performance:
 *   - useSidebarVisible()
 *   - useSidePanelState()
 *   - useSettingsModalState()
 */
export function useUIContext(): UIContextValue {
  const store = useUIStore();

  return {
    // Sidebar
    sidebarVisible: store.sidebarVisible,
    isNarrowLayout: store.isNarrowLayout,
    toggleSidebar: store.toggleSidebar,

    // Side Panel
    sidePanelVisible: store.sidePanelVisible,
    setSidePanelVisible: store.setSidePanelVisible,
    activeSidePanelTab: store.activeSidePanelTab,
    setActiveSidePanelTab: store.setActiveSidePanelTab,
    sidePanelWidth: store.sidePanelWidth,
    setSidePanelWidth: store.setSidePanelWidth,

    // Settings
    settingsOpen: store.settingsOpen,
    openSettings: store.openSettings,
    closeSettings: store.closeSettings,

    // Handlers
    handleSideAction: store.handleSideAction,
    handleSidePanelClose: store.handleSidePanelClose,
    handleSidePanelTabChange: store.handleSidePanelTabChange,
  };
}

// Export types
export type { UIContextValue };
