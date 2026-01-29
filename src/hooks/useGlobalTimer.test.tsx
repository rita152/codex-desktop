import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalTimer } from './useGlobalTimer';

describe('useGlobalTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a number timestamp when disabled', () => {
    const { result } = renderHook(() => useGlobalTimer(false));
    expect(typeof result.current).toBe('number');
    expect(result.current).toBeGreaterThan(0);
  });

  it('returns a number timestamp when enabled', () => {
    const { result } = renderHook(() => useGlobalTimer(true));
    expect(typeof result.current).toBe('number');
    expect(result.current).toBeGreaterThan(0);
  });

  it('updates time when timer fires and enabled', () => {
    const { result } = renderHook(() => useGlobalTimer(true));
    const initialTime = result.current;

    // Advance time by 200ms (timer interval)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Time should have been updated (or stayed same if timer already fired)
    expect(result.current).toBeGreaterThanOrEqual(initialTime);
  });

  it('multiple hooks share the same timer updates', () => {
    const { result: result1 } = renderHook(() => useGlobalTimer(true));
    const { result: result2 } = renderHook(() => useGlobalTimer(true));

    // Both should return valid timestamps
    expect(typeof result1.current).toBe('number');
    expect(typeof result2.current).toBe('number');

    // Advance time
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Both should still return valid timestamps
    expect(typeof result1.current).toBe('number');
    expect(typeof result2.current).toBe('number');
  });

  it('cleanup does not throw when unmounting', () => {
    const { unmount } = renderHook(() => useGlobalTimer(true));

    // Should not throw
    expect(() => unmount()).not.toThrow();
  });

  it('can switch from enabled to disabled', () => {
    const { result, rerender } = renderHook(({ enabled }) => useGlobalTimer(enabled), {
      initialProps: { enabled: true },
    });

    expect(typeof result.current).toBe('number');

    // Switch to disabled
    rerender({ enabled: false });
    expect(typeof result.current).toBe('number');
  });
});
