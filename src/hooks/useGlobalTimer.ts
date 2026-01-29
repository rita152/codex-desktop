import { useSyncExternalStore, useCallback } from 'react';
import { PERFORMANCE } from '../constants/performance';

type Subscriber = () => void;

/**
 * Global timer singleton that manages a single interval shared across all subscribers.
 * Automatically starts when first subscriber joins and stops when last subscriber leaves.
 */
class GlobalTimer {
  private subscribers = new Set<Subscriber>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentTime = Date.now();

  subscribe = (callback: Subscriber): (() => void) => {
    this.subscribers.add(callback);
    this.startIfNeeded();
    return () => {
      this.subscribers.delete(callback);
      this.stopIfEmpty();
    };
  };

  getSnapshot = (): number => this.currentTime;

  private tick = () => {
    this.currentTime = Date.now();
    this.subscribers.forEach((cb) => cb());
  };

  private startIfNeeded() {
    if (this.intervalId === null && this.subscribers.size > 0) {
      this.intervalId = setInterval(this.tick, PERFORMANCE.WORKING_TIMER_INTERVAL_MS);
    }
  }

  private stopIfEmpty() {
    if (this.subscribers.size === 0 && this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

const globalTimer = new GlobalTimer();

// Empty subscribe function for disabled state
const emptySubscribe = () => () => {};

/**
 * Hook to get current time from a global timer.
 * When enabled, subscribes to a shared timer that updates every WORKING_TIMER_INTERVAL_MS.
 * When disabled, returns current Date.now() without subscribing.
 *
 * @param enabled - Whether to subscribe to the global timer
 * @returns Current timestamp in milliseconds
 */
export function useGlobalTimer(enabled: boolean): number {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!enabled) return emptySubscribe();
      return globalTimer.subscribe(callback);
    },
    [enabled]
  );

  const getSnapshot = useCallback(() => {
    return enabled ? globalTimer.getSnapshot() : Date.now();
  }, [enabled]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
