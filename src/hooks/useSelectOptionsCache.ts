import { useCallback, useEffect, useState } from 'react';

import type { Dispatch, SetStateAction } from 'react';
import type { ChatSession } from '../components/business/Sidebar/types';
import type { SelectOption } from '../types/options';

type OptionsCacheState = {
  options: SelectOption[] | null;
  currentId?: string;
};

type CachePayload = {
  options: SelectOption[];
  currentId?: string;
};

type UseSelectOptionsCacheArgs = {
  sessions: ChatSession[];
  defaultId: string;
  loadCache: () => CachePayload | null;
  saveCache: (payload: CachePayload) => void;
  setSessionOptions: Dispatch<SetStateAction<Record<string, SelectOption[]>>>;
};

type ApplyOptionsArgs = {
  options: SelectOption[];
  currentId?: string;
  fallbackCurrentId?: string;
};

export function useSelectOptionsCache({
  sessions,
  defaultId,
  loadCache,
  saveCache,
  setSessionOptions,
}: UseSelectOptionsCacheArgs) {
  const [cache, setCache] = useState<OptionsCacheState>(() => {
    const cached = loadCache();
    return {
      options: cached?.options ?? null,
      currentId: cached?.currentId ?? defaultId,
    };
  });

  useEffect(() => {
    const cachedOptions = cache.options;
    if (!cachedOptions || cachedOptions.length === 0) return;
    setSessionOptions((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const session of sessions) {
        if (next[session.id]?.length) continue;
        next[session.id] = cachedOptions;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [cache.options, sessions, setSessionOptions]);

  const applyOptions = useCallback(
    ({ options, currentId, fallbackCurrentId }: ApplyOptionsArgs) => {
      const nextCurrentId = currentId ?? fallbackCurrentId;
      const nextState = { options, currentId: nextCurrentId };
      setCache(nextState);
      saveCache(nextState);
    },
    [saveCache]
  );

  return {
    cache,
    applyOptions,
  };
}
