import { describe, it, expect, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { useState } from 'react';

import { useSelectOptionsCache } from './useSelectOptionsCache';

import type { ChatSession } from '../components/business/Sidebar/types';
import type { SelectOption } from '../components/ui/data-entry/Select/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useSelectOptionsCache', () => {
  it('hydrates session options from cache and applies updates', () => {
    const sessions: ChatSession[] = [{ id: '1', title: 'Session 1' }];
    const cachedOptions: SelectOption[] = [{ value: 'a', label: 'A' }];
    const saveCache = vi.fn();

    let latest:
      | {
          cache: { options: SelectOption[] | null; currentId?: string };
          applyOptions: (payload: {
            options: SelectOption[];
            currentId?: string;
            fallbackCurrentId?: string;
          }) => void;
          sessionOptions: Record<string, SelectOption[]>;
        }
      | undefined;

    function Test({ items }: { items: ChatSession[] }) {
      const [sessionOptions, setSessionOptions] = useState<Record<string, SelectOption[]>>({});
      const hook = useSelectOptionsCache({
        sessions: items,
        defaultId: 'default',
        loadCache: () => ({ options: cachedOptions, currentId: 'a' }),
        saveCache,
        setSessionOptions,
      });
      latest = { ...hook, sessionOptions };
      return null;
    }

    act(() => {
      create(<Test items={sessions} />);
    });

    expect(latest?.cache.options).toEqual(cachedOptions);
    expect(latest?.sessionOptions['1']).toEqual(cachedOptions);

    const nextOptions: SelectOption[] = [{ value: 'b', label: 'B' }];
    act(() => {
      latest?.applyOptions({ options: nextOptions, currentId: 'b' });
    });

    expect(saveCache).toHaveBeenCalledWith({ options: nextOptions, currentId: 'b' });
    expect(latest?.cache.currentId).toBe('b');
  });
});
