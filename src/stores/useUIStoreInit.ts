/**
 * UI Store Initialization Hook
 *
 * Handles side effects that need to sync with the UI store:
 * - Window resize listener for responsive layout
 * - Auto-hide sidebar/sidepanel on narrow screens
 */

import { useEffect } from 'react';

import { useUIStore, SIDEBAR_AUTO_HIDE_MAX_WIDTH } from './uiStore';

/**
 * Initialize UI store with window resize handling.
 * Call this once at the app root level.
 */
export function useUIStoreInit(): void {
  const setIsNarrowLayout = useUIStore((state) => state.setIsNarrowLayout);
  const setSidebarVisible = useUIStore((state) => state.setSidebarVisible);
  const setSidePanelVisible = useUIStore((state) => state.setSidePanelVisible);

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
}
