// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect, useState } from 'react';

import { useSelectOptionsCache } from './useSelectOptionsCache';

import type { ChatSession } from '../components/business/Sidebar/types';
import type { SelectOption } from '../components/ui/data-entry/Select/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useSelectOptionsCache', () => {
  it('hydrates session options from cache and applies updates', () => {
    const sessions: ChatSession[] = [{ id: '1', title: 'Session 1' }];
    const cachedOptions: SelectOption[] = [{ value: 'a', label: 'A' }];
    const saveCache = vi.fn();

    type LatestState = {
      cache: { options: SelectOption[] | null; currentId?: string };
      applyOptions: (payload: {
        options: SelectOption[];
        currentId?: string;
        fallbackCurrentId?: string;
      }) => void;
      sessionOptions: Record<string, SelectOption[]>;
    };

    let latest: LatestState | undefined;

    const handleUpdate = (nextState: LatestState) => {
      latest = nextState;
    };

    function Test({ items, onUpdate }: { items: ChatSession[]; onUpdate: typeof handleUpdate }) {
      const [sessionOptions, setSessionOptions] = useState<Record<string, SelectOption[]>>({});
      const hook = useSelectOptionsCache({
        sessions: items,
        defaultId: 'default',
        loadCache: () => ({ options: cachedOptions, currentId: 'a' }),
        saveCache,
        setSessionOptions,
      });
      useEffect(() => {
        onUpdate({ ...hook, sessionOptions });
      }, [hook, onUpdate, sessionOptions]);
      return null;
    }

    render(<Test items={sessions} onUpdate={handleUpdate} />);

    expect(latest?.cache.options).toEqual(cachedOptions);
    expect(latest?.sessionOptions['1']).toEqual(cachedOptions);

    const nextOptions: SelectOption[] = [{ value: 'b', label: 'B' }];
    act(() => {
      latest?.applyOptions({ options: nextOptions, currentId: 'b' });
    });

    expect(saveCache).toHaveBeenCalledWith({ options: nextOptions, currentId: 'b' });
    expect(latest?.cache.currentId).toBe('b');
  });

  it('skips hydration when cache is empty', () => {
    const sessions: ChatSession[] = [{ id: '1', title: 'Session 1' }];
    const saveCache = vi.fn();

    type LatestState = {
      cache: { options: SelectOption[] | null; currentId?: string };
      sessionOptions: Record<string, SelectOption[]>;
    };

    let latest: LatestState | undefined;

    const handleUpdate = (nextState: LatestState) => {
      latest = nextState;
    };

    function Test({ onUpdate }: { onUpdate: typeof handleUpdate }) {
      const [sessionOptions, setSessionOptions] = useState<Record<string, SelectOption[]>>({});
      const hook = useSelectOptionsCache({
        sessions,
        defaultId: 'default',
        loadCache: () => null,
        saveCache,
        setSessionOptions,
      });
      useEffect(() => {
        onUpdate({ cache: hook.cache, sessionOptions });
      }, [hook.cache, onUpdate, sessionOptions]);
      return null;
    }

    render(<Test onUpdate={handleUpdate} />);

    expect(latest?.cache.options).toBeNull();
    expect(latest?.cache.currentId).toBe('default');
    expect(latest?.sessionOptions['1']).toBeUndefined();
  });

  it('preserves existing session options and uses fallback id', () => {
    const sessions: ChatSession[] = [{ id: '1', title: 'Session 1' }];
    const saveCache = vi.fn();
    const existingOptions: SelectOption[] = [{ value: 'existing', label: 'Existing' }];

    type LatestState = {
      cache: { options: SelectOption[] | null; currentId?: string };
      applyOptions: (payload: {
        options: SelectOption[];
        currentId?: string;
        fallbackCurrentId?: string;
      }) => void;
      sessionOptions: Record<string, SelectOption[]>;
    };

    let latest: LatestState | undefined;

    const handleUpdate = (nextState: LatestState) => {
      latest = nextState;
    };

    function Test({ onUpdate }: { onUpdate: typeof handleUpdate }) {
      const [sessionOptions, setSessionOptions] = useState<Record<string, SelectOption[]>>({
        '1': existingOptions,
      });
      const hook = useSelectOptionsCache({
        sessions,
        defaultId: 'default',
        loadCache: () => ({ options: [{ value: 'cached', label: 'Cached' }] }),
        saveCache,
        setSessionOptions,
      });
      useEffect(() => {
        onUpdate({ ...hook, sessionOptions });
      }, [hook, onUpdate, sessionOptions]);
      return null;
    }

    render(<Test onUpdate={handleUpdate} />);

    expect(latest?.sessionOptions['1']).toEqual(existingOptions);

    const nextOptions: SelectOption[] = [{ value: 'next', label: 'Next' }];
    act(() => {
      latest?.applyOptions({ options: nextOptions, fallbackCurrentId: 'fallback' });
    });

    expect(latest?.cache.currentId).toBe('fallback');
    expect(saveCache).toHaveBeenCalledWith({ options: nextOptions, currentId: 'fallback' });
  });
});
