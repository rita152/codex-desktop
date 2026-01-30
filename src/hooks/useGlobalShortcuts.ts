/**
 * Global Shortcuts Hook
 * Provides global keyboard shortcut handling with customizable bindings
 */

import { useEffect, useCallback, useRef } from 'react';
import type { ShortcutSettings } from '../types/settings';

export interface ShortcutActions {
  newSession: () => void;
  sendMessage: () => void;
  stopGeneration: () => void;
  openSettings: () => void;
  toggleSidebar: () => void;
  toggleTerminal: () => void;
}

interface UseGlobalShortcutsOptions {
  shortcuts: ShortcutSettings;
  actions: ShortcutActions;
  enabled?: boolean;
}

/**
 * Parse a shortcut string into its components
 * e.g., "CmdOrCtrl+Shift+N" -> { ctrl: true, shift: true, alt: false, key: 'n' }
 */
function parseShortcut(shortcut: string): {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
} {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1];

  return {
    ctrl: parts.includes('cmdorctrl') || parts.includes('ctrl') || parts.includes('cmd'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: key === 'escape' ? 'escape' : key,
  };
}

/**
 * Check if an event matches a shortcut configuration
 */
function matchesShortcut(
  event: KeyboardEvent,
  shortcut: { ctrl: boolean; shift: boolean; alt: boolean; key: string }
): boolean {
  const ctrlOrMeta = event.ctrlKey || event.metaKey;

  // For simple keys like Enter or Escape without modifiers
  if (!shortcut.ctrl && !shortcut.shift && !shortcut.alt) {
    return (
      event.key.toLowerCase() === shortcut.key && !event.ctrlKey && !event.metaKey && !event.altKey
    );
  }

  return (
    ctrlOrMeta === shortcut.ctrl &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt &&
    event.key.toLowerCase() === shortcut.key
  );
}

/**
 * Check if the event target is an input element
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  const isEditable = target.isContentEditable;
  const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';

  return isInput || isEditable;
}

/**
 * Hook for handling global keyboard shortcuts
 */
export function useGlobalShortcuts({
  shortcuts,
  actions,
  enabled = true,
}: UseGlobalShortcutsOptions): void {
  // Use refs to avoid stale closures
  const shortcutsRef = useRef(shortcuts);
  const actionsRef = useRef(actions);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const currentShortcuts = shortcutsRef.current;
      const currentActions = actionsRef.current;

      // Parse all shortcuts
      const parsed = {
        newSession: parseShortcut(currentShortcuts.newSession),
        sendMessage: parseShortcut(currentShortcuts.sendMessage),
        stopGeneration: parseShortcut(currentShortcuts.stopGeneration),
        openSettings: parseShortcut(currentShortcuts.openSettings),
        toggleSidebar: parseShortcut(currentShortcuts.toggleSidebar),
        toggleTerminal: parseShortcut(currentShortcuts.toggleTerminal),
      };

      const isInput = isInputElement(event.target);

      // Handle shortcuts that work everywhere (even in input fields)
      // Stop generation (Escape) - works everywhere
      if (matchesShortcut(event, parsed.stopGeneration)) {
        event.preventDefault();
        currentActions.stopGeneration();
        return;
      }

      // Send message (Enter) - only in input fields, handled by input component
      // Don't handle it here to avoid double-firing
      if (matchesShortcut(event, parsed.sendMessage) && isInput) {
        // Let the input component handle this
        return;
      }

      // For other shortcuts, don't trigger when in input fields
      if (isInput) {
        // But still allow modifier-based shortcuts in input fields
        const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
        if (!hasModifier) return;
      }

      // New session
      if (matchesShortcut(event, parsed.newSession)) {
        event.preventDefault();
        currentActions.newSession();
        return;
      }

      // Open settings
      if (matchesShortcut(event, parsed.openSettings)) {
        event.preventDefault();
        currentActions.openSettings();
        return;
      }

      // Toggle sidebar
      if (matchesShortcut(event, parsed.toggleSidebar)) {
        event.preventDefault();
        currentActions.toggleSidebar();
        return;
      }

      // Toggle terminal
      if (matchesShortcut(event, parsed.toggleTerminal)) {
        event.preventDefault();
        currentActions.toggleTerminal();
        return;
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleKeyDown, enabled]);
}
