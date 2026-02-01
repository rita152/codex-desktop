/**
 * UI Store - Manages UI-related state with Zustand
 *
 * This store handles:
 * - Sidebar visibility
 * - Side panel state (visibility, active tab, width)
 * - Settings modal state
 * - Layout responsiveness
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';

import type { SidePanelTab } from '../components/business/UnifiedSidePanel';
import type { SettingsSection } from '../types/settings';

// Constants
export const SIDEBAR_AUTO_HIDE_MAX_WIDTH = 900;
export const DEFAULT_SIDE_PANEL_WIDTH = 260;
export const MIN_SIDE_PANEL_WIDTH = 260;
export const MIN_CONVERSATION_WIDTH = 240;

// Types
interface UIState {
  // Sidebar
  sidebarVisible: boolean;
  isNarrowLayout: boolean;

  // Side Panel
  sidePanelVisible: boolean;
  activeSidePanelTab: SidePanelTab;
  sidePanelWidth: number;

  // Settings Modal
  settingsOpen: boolean;
  settingsInitialSection?: SettingsSection;
}

interface UIActions {
  // Sidebar actions
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  setIsNarrowLayout: (isNarrow: boolean) => void;

  // Side Panel actions
  setSidePanelVisible: (visible: boolean) => void;
  setActiveSidePanelTab: (tab: SidePanelTab) => void;
  setSidePanelWidth: (width: number) => void;
  handleSideAction: (actionId: string) => void;
  handleSidePanelClose: () => void;
  handleSidePanelTabChange: (tab: SidePanelTab) => void;

  // Settings Modal actions
  openSettings: (initialSection?: SettingsSection) => void;
  closeSettings: () => void;
}

export type UIStore = UIState & UIActions;

// Initial state
const initialState: UIState = {
  sidebarVisible: true,
  isNarrowLayout: false,
  sidePanelVisible: false,
  activeSidePanelTab: 'explorer',
  sidePanelWidth: DEFAULT_SIDE_PANEL_WIDTH,
  settingsOpen: false,
  settingsInitialSection: undefined,
};

// Create the store
export const useUIStore = create<UIStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      // Sidebar actions
      toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),

      setSidebarVisible: (visible) => set({ sidebarVisible: visible }),

      setIsNarrowLayout: (isNarrow) => set({ isNarrowLayout: isNarrow }),

      // Side Panel actions
      setSidePanelVisible: (visible) => set({ sidePanelVisible: visible }),

      setActiveSidePanelTab: (tab) => set({ activeSidePanelTab: tab }),

      setSidePanelWidth: (width) => set({ sidePanelWidth: width }),

      handleSideAction: (actionId) => {
        const { sidePanelVisible, activeSidePanelTab } = get();
        const tabId = actionId as SidePanelTab;

        if (sidePanelVisible && activeSidePanelTab === tabId) {
          // Toggle off if clicking the same active tab
          set({ sidePanelVisible: false });
        } else {
          // Switch tab and ensure open
          set({ activeSidePanelTab: tabId, sidePanelVisible: true });
        }
      },

      handleSidePanelClose: () => set({ sidePanelVisible: false }),

      handleSidePanelTabChange: (tab) => set({ activeSidePanelTab: tab }),

      // Settings Modal actions
      openSettings: (initialSection) =>
        set({ settingsOpen: true, settingsInitialSection: initialSection }),

      closeSettings: () => set({ settingsOpen: false, settingsInitialSection: undefined }),
    })),
    { name: 'UIStore', enabled: import.meta.env.DEV }
  )
);

// Selectors for optimized subscriptions
export const useSidebarVisible = () => useUIStore((state) => state.sidebarVisible);
export const useIsNarrowLayout = () => useUIStore((state) => state.isNarrowLayout);
export const useSidePanelVisible = () => useUIStore((state) => state.sidePanelVisible);
export const useActiveSidePanelTab = () => useUIStore((state) => state.activeSidePanelTab);
export const useSidePanelWidth = () => useUIStore((state) => state.sidePanelWidth);
export const useSettingsOpen = () => useUIStore((state) => state.settingsOpen);

// Grouped selectors
export const useSidebarState = () =>
  useUIStore((state) => ({
    visible: state.sidebarVisible,
    isNarrowLayout: state.isNarrowLayout,
    toggle: state.toggleSidebar,
  }));

export const useSidePanelState = () =>
  useUIStore((state) => ({
    visible: state.sidePanelVisible,
    activeTab: state.activeSidePanelTab,
    width: state.sidePanelWidth,
    setVisible: state.setSidePanelVisible,
    setActiveTab: state.setActiveSidePanelTab,
    setWidth: state.setSidePanelWidth,
    close: state.handleSidePanelClose,
    changeTab: state.handleSidePanelTabChange,
  }));

export const useSettingsModalState = () =>
  useUIStore((state) => ({
    isOpen: state.settingsOpen,
    open: state.openSettings,
    close: state.closeSettings,
  }));
