/**
 * UI Context - DEPRECATED Bridge layer for UIStore
 *
 * @deprecated This entire module is deprecated. Use stores directly:
 *   import { useUIStore, useSidebarVisible, useUIStoreInit } from '../stores';
 *
 * Migration guide:
 * - Replace UIProvider with useUIStoreInit() hook call in App component
 * - Replace useUIContext() with individual UIStore selectors
 *
 * This file will be removed in a future version.
 */

import type { ReactNode } from 'react';

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

// Provider Component
interface UIProviderProps {
  children: ReactNode;
}

/**
 * @deprecated Use useUIStoreInit() hook instead.
 * This provider is now a no-op pass-through.
 */
export function UIProvider({ children }: UIProviderProps) {
  // No-op: responsive layout is now handled by useUIStoreInit()
  // This provider exists only for backward compatibility
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
