/**
 * History List Hook
 *
 * Manages loading and refreshing history sessions from rollout files.
 * History sessions are loaded from the backend via codex_list_history command.
 */

import { useState, useCallback, useEffect } from 'react';

import { listHistory } from '../api/codex';
import { devDebug } from '../utils/logger';

import type { HistoryItem } from '../types/codex';

export interface UseHistoryListResult {
  /** List of history items */
  items: HistoryItem[];
  /** Whether the list is currently loading */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Whether more items are available */
  hasMore: boolean;
  /** Refresh the history list */
  refresh: () => Promise<void>;
}

/**
 * Hook for loading history sessions from rollout files.
 *
 * @param autoLoad - Whether to automatically load on mount (default: true)
 * @param pageSize - Maximum number of items to load (default: 50)
 */
export function useHistoryList(autoLoad = true, pageSize = 50): UseHistoryListResult {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await listHistory(pageSize);
      devDebug('[history] loaded items', result.items.length);
      setItems(result.items);
      setHasMore(result.hasMore);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      devDebug('[history] load failed', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    if (autoLoad) {
      void refresh();
    }
  }, [autoLoad, refresh]);

  return {
    items,
    loading,
    error,
    hasMore,
    refresh,
  };
}
