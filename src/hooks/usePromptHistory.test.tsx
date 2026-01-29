import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePromptHistory } from './usePromptHistory';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('usePromptHistory', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should start with empty history', () => {
    const { result } = renderHook(() => usePromptHistory());
    expect(result.current.history).toEqual([]);
    expect(result.current.isNavigating).toBe(false);
    expect(result.current.historyIndex).toBe(-1);
  });

  it('should add prompts to history', () => {
    const { result } = renderHook(() => usePromptHistory());

    act(() => {
      result.current.addToHistory('first prompt');
    });

    expect(result.current.history).toEqual(['first prompt']);

    act(() => {
      result.current.addToHistory('second prompt');
    });

    // Most recent first
    expect(result.current.history).toEqual(['second prompt', 'first prompt']);
  });

  it('should deduplicate prompts', () => {
    const { result } = renderHook(() => usePromptHistory());

    act(() => {
      result.current.addToHistory('hello');
      result.current.addToHistory('world');
      result.current.addToHistory('hello'); // duplicate
    });

    // 'hello' should be moved to the front
    expect(result.current.history).toEqual(['hello', 'world']);
  });

  it('should not add empty prompts', () => {
    const { result } = renderHook(() => usePromptHistory());

    act(() => {
      result.current.addToHistory('');
      result.current.addToHistory('   ');
    });

    expect(result.current.history).toEqual([]);
  });

  it('should navigate to previous prompts', () => {
    const { result } = renderHook(() => usePromptHistory());

    act(() => {
      result.current.addToHistory('first');
      result.current.addToHistory('second');
      result.current.addToHistory('third');
    });

    // History order: ['third', 'second', 'first']

    let previousPrompt: string | null = null;

    act(() => {
      previousPrompt = result.current.goToPrevious('current draft');
    });

    expect(previousPrompt).toBe('third');
    expect(result.current.isNavigating).toBe(true);
    expect(result.current.historyIndex).toBe(0);

    act(() => {
      previousPrompt = result.current.goToPrevious('');
    });

    expect(previousPrompt).toBe('second');
    expect(result.current.historyIndex).toBe(1);

    act(() => {
      previousPrompt = result.current.goToPrevious('');
    });

    expect(previousPrompt).toBe('first');
    expect(result.current.historyIndex).toBe(2);

    // Try to go beyond the oldest
    act(() => {
      previousPrompt = result.current.goToPrevious('');
    });

    expect(previousPrompt).toBeNull();
    expect(result.current.historyIndex).toBe(2); // Should stay at 2
  });

  it('should navigate to next prompts and return draft', () => {
    const { result } = renderHook(() => usePromptHistory());

    act(() => {
      result.current.addToHistory('first');
    });

    act(() => {
      result.current.addToHistory('second');
    });

    // Navigate up once
    act(() => {
      result.current.goToPrevious('my draft');
    });

    // Navigate up again
    act(() => {
      result.current.goToPrevious('');
    });

    expect(result.current.historyIndex).toBe(1);

    let nextPrompt: string | null = null;

    act(() => {
      nextPrompt = result.current.goToNext();
    });

    expect(nextPrompt).toBe('second');
    expect(result.current.historyIndex).toBe(0);

    act(() => {
      nextPrompt = result.current.goToNext();
    });

    // Should return the draft
    expect(nextPrompt).toBe('my draft');
    expect(result.current.historyIndex).toBe(-1);
    expect(result.current.isNavigating).toBe(false);
  });

  it('should reset navigation', () => {
    const { result } = renderHook(() => usePromptHistory());

    act(() => {
      result.current.addToHistory('first');
    });

    act(() => {
      result.current.goToPrevious('draft');
    });

    expect(result.current.isNavigating).toBe(true);

    act(() => {
      result.current.resetNavigation();
    });

    expect(result.current.isNavigating).toBe(false);
    expect(result.current.historyIndex).toBe(-1);
  });

  it('should persist to localStorage', () => {
    const { result } = renderHook(() => usePromptHistory());

    act(() => {
      result.current.addToHistory('persisted prompt');
    });

    expect(localStorageMock.setItem).toHaveBeenCalled();

    const savedData = localStorageMock.setItem.mock.calls[0][1];
    expect(JSON.parse(savedData)).toEqual(['persisted prompt']);
  });

  it('should return null when navigating empty history', () => {
    const { result } = renderHook(() => usePromptHistory());

    let previousPrompt: string | null = null;

    act(() => {
      previousPrompt = result.current.goToPrevious('draft');
    });

    expect(previousPrompt).toBeNull();
  });

  it('should return null when already at draft', () => {
    const { result } = renderHook(() => usePromptHistory());

    let nextPrompt: string | null = null;

    act(() => {
      nextPrompt = result.current.goToNext();
    });

    expect(nextPrompt).toBeNull();
  });
});
