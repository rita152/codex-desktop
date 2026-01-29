import { useState, useCallback, useRef } from 'react';

const STORAGE_KEY = 'codex-prompt-history';
const MAX_HISTORY_SIZE = 100;

export interface PromptHistoryResult {
  /**
   * Add a new prompt to the history.
   * Automatically deduplicates and trims to MAX_HISTORY_SIZE.
   */
  addToHistory: (prompt: string) => void;

  /**
   * Navigate to the previous prompt in history (older).
   * Returns the previous prompt or null if at the beginning.
   */
  goToPrevious: (currentDraft: string) => string | null;

  /**
   * Navigate to the next prompt in history (newer).
   * Returns the next prompt, the draft, or null if at the end.
   */
  goToNext: () => string | null;

  /**
   * Reset the navigation index (e.g., when user submits or clears input).
   */
  resetNavigation: () => void;

  /**
   * Check if currently navigating through history.
   */
  isNavigating: boolean;

  /**
   * The current history index (-1 means not navigating).
   */
  historyIndex: number;

  /**
   * The full history array (most recent first).
   */
  history: string[];
}

function loadHistory(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function saveHistory(history: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

/**
 * Hook for managing prompt history with arrow key navigation.
 * History is persisted to localStorage.
 *
 * Navigation works like a terminal:
 * - Arrow Up: Go to older prompts
 * - Arrow Down: Go to newer prompts or back to the draft
 */
export function usePromptHistory(): PromptHistoryResult {
  // History array: most recent first (index 0 = newest)
  const [history, setHistory] = useState<string[]>(loadHistory);

  // Navigation index: -1 means not navigating (showing draft)
  // 0 = most recent, 1 = second most recent, etc.
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Store the current draft when user starts navigating
  const draftRef = useRef<string>('');

  const addToHistory = useCallback((prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setHistory((prev) => {
      // Remove duplicates (case-sensitive)
      const filtered = prev.filter((item) => item !== trimmed);
      // Add to the beginning (most recent first)
      const newHistory = [trimmed, ...filtered].slice(0, MAX_HISTORY_SIZE);
      saveHistory(newHistory);
      return newHistory;
    });

    // Reset navigation after adding
    setHistoryIndex(-1);
    draftRef.current = '';
  }, []);

  const goToPrevious = useCallback(
    (currentDraft: string): string | null => {
      if (history.length === 0) return null;

      // If we're not navigating yet, save the current draft
      if (historyIndex === -1) {
        draftRef.current = currentDraft;
      }

      const nextIndex = historyIndex + 1;

      // Check if we can go further back
      if (nextIndex >= history.length) {
        return null; // Already at the oldest
      }

      setHistoryIndex(nextIndex);
      return history[nextIndex];
    },
    [history, historyIndex]
  );

  const goToNext = useCallback((): string | null => {
    if (historyIndex === -1) {
      return null; // Already at draft
    }

    const nextIndex = historyIndex - 1;

    if (nextIndex < 0) {
      // Return to draft
      setHistoryIndex(-1);
      return draftRef.current;
    }

    setHistoryIndex(nextIndex);
    return history[nextIndex];
  }, [history, historyIndex]);

  const resetNavigation = useCallback(() => {
    setHistoryIndex(-1);
    draftRef.current = '';
  }, []);

  return {
    addToHistory,
    goToPrevious,
    goToNext,
    resetNavigation,
    isNavigating: historyIndex >= 0,
    historyIndex,
    history,
  };
}
