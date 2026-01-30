// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';
import { resetUIStore } from './testUtils';

describe('UIStore', () => {
  beforeEach(() => {
    resetUIStore();
  });

  describe('sidebar', () => {
    it('should toggle sidebar visibility', () => {
      expect(useUIStore.getState().sidebarVisible).toBe(true);

      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarVisible).toBe(false);

      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarVisible).toBe(true);
    });

    it('should set sidebar visibility directly', () => {
      useUIStore.getState().setSidebarVisible(false);
      expect(useUIStore.getState().sidebarVisible).toBe(false);

      useUIStore.getState().setSidebarVisible(true);
      expect(useUIStore.getState().sidebarVisible).toBe(true);
    });

    it('should track narrow layout state', () => {
      expect(useUIStore.getState().isNarrowLayout).toBe(false);

      useUIStore.getState().setIsNarrowLayout(true);
      expect(useUIStore.getState().isNarrowLayout).toBe(true);
    });
  });

  describe('side panel', () => {
    it('should toggle side panel visibility', () => {
      expect(useUIStore.getState().sidePanelVisible).toBe(false);

      useUIStore.getState().setSidePanelVisible(true);
      expect(useUIStore.getState().sidePanelVisible).toBe(true);

      useUIStore.getState().handleSidePanelClose();
      expect(useUIStore.getState().sidePanelVisible).toBe(false);
    });

    it('should switch active tab', () => {
      expect(useUIStore.getState().activeSidePanelTab).toBe('explorer');

      useUIStore.getState().setActiveSidePanelTab('terminal');
      expect(useUIStore.getState().activeSidePanelTab).toBe('terminal');
    });

    it('should handle side action - open panel and switch tab', () => {
      // Panel is closed, clicking action should open it
      useUIStore.getState().handleSideAction('terminal');
      expect(useUIStore.getState().sidePanelVisible).toBe(true);
      expect(useUIStore.getState().activeSidePanelTab).toBe('terminal');
    });

    it('should handle side action - close panel when clicking same tab', () => {
      // Open panel with terminal tab
      useUIStore.getState().handleSideAction('terminal');
      expect(useUIStore.getState().sidePanelVisible).toBe(true);

      // Click terminal again - should close
      useUIStore.getState().handleSideAction('terminal');
      expect(useUIStore.getState().sidePanelVisible).toBe(false);
    });

    it('should handle side action - switch tab when panel is open', () => {
      // Open panel with terminal tab
      useUIStore.getState().handleSideAction('terminal');

      // Click explorer - should switch tab, panel stays open
      useUIStore.getState().handleSideAction('explorer');
      expect(useUIStore.getState().sidePanelVisible).toBe(true);
      expect(useUIStore.getState().activeSidePanelTab).toBe('explorer');
    });

    it('should set panel width', () => {
      expect(useUIStore.getState().sidePanelWidth).toBe(260);

      useUIStore.getState().setSidePanelWidth(400);
      expect(useUIStore.getState().sidePanelWidth).toBe(400);
    });
  });

  describe('settings modal', () => {
    it('should open and close settings', () => {
      expect(useUIStore.getState().settingsOpen).toBe(false);

      useUIStore.getState().openSettings();
      expect(useUIStore.getState().settingsOpen).toBe(true);

      useUIStore.getState().closeSettings();
      expect(useUIStore.getState().settingsOpen).toBe(false);
    });
  });
});
