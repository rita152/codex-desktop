/**
 * Global keyboard shortcuts hook for settings
 * Allows opening settings via Cmd/Ctrl + ,
 */

import { useEffect, useCallback } from 'react';
import type { ShortcutSettings } from '../types/settings';

interface UseSettingsShortcutsOptions {
    shortcuts: ShortcutSettings;
    onOpenSettings?: () => void;
    onNewSession?: () => void;
    onToggleSidebar?: () => void;
    onToggleTerminal?: () => void;
    enabled?: boolean;
}

/**
 * Parse shortcut string to modifiers and key
 * e.g., "CmdOrCtrl+," -> { meta: true, ctrl: true, key: "," }
 */
function parseShortcut(shortcut: string): {
    meta: boolean;
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    key: string;
} {
    const parts = shortcut.split('+');
    const key = parts[parts.length - 1].toLowerCase();
    const modifiers = parts.slice(0, -1);

    return {
        meta: modifiers.includes('CmdOrCtrl') || modifiers.includes('Cmd'),
        ctrl: modifiers.includes('CmdOrCtrl') || modifiers.includes('Ctrl'),
        shift: modifiers.includes('Shift'),
        alt: modifiers.includes('Alt'),
        key,
    };
}

/**
 * Check if keyboard event matches a shortcut
 */
function matchesShortcut(
    event: KeyboardEvent,
    shortcut: { meta: boolean; ctrl: boolean; shift: boolean; alt: boolean; key: string }
): boolean {
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const modifierMatch = isMac
        ? (shortcut.meta && event.metaKey) || (shortcut.ctrl && event.ctrlKey)
        : shortcut.ctrl && event.ctrlKey;

    if (!modifierMatch && (shortcut.meta || shortcut.ctrl)) return false;
    if (shortcut.shift !== event.shiftKey) return false;
    if (shortcut.alt !== event.altKey) return false;

    return event.key.toLowerCase() === shortcut.key;
}

export function useSettingsShortcuts({
    shortcuts,
    onOpenSettings,
    onNewSession,
    onToggleSidebar,
    onToggleTerminal,
    enabled = true,
}: UseSettingsShortcutsOptions) {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled) return;

        // Don't trigger shortcuts when typing in inputs
        const target = event.target as HTMLElement;
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        ) {
            return;
        }

        // Check for open settings shortcut
        if (onOpenSettings && matchesShortcut(event, parseShortcut(shortcuts.openSettings))) {
            event.preventDefault();
            onOpenSettings();
            return;
        }

        // Check for new session shortcut
        if (onNewSession && matchesShortcut(event, parseShortcut(shortcuts.newSession))) {
            event.preventDefault();
            onNewSession();
            return;
        }

        // Check for toggle sidebar shortcut
        if (onToggleSidebar && matchesShortcut(event, parseShortcut(shortcuts.toggleSidebar))) {
            event.preventDefault();
            onToggleSidebar();
            return;
        }

        // Check for toggle terminal shortcut
        if (onToggleTerminal && matchesShortcut(event, parseShortcut(shortcuts.toggleTerminal))) {
            event.preventDefault();
            onToggleTerminal();
            return;
        }
    }, [
        enabled,
        shortcuts.openSettings,
        shortcuts.newSession,
        shortcuts.toggleSidebar,
        shortcuts.toggleTerminal,
        onOpenSettings,
        onNewSession,
        onToggleSidebar,
        onToggleTerminal,
    ]);

    useEffect(() => {
        if (!enabled) return;

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [enabled, handleKeyDown]);
}
