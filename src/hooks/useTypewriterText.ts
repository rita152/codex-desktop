import { useEffect, useRef, useState } from 'react';

export function useTypewriterText(
  targetText: string,
  enabled: boolean,
  speedCharsPerSecond = 120,
  maxCharsPerFrame = 12
): string {
  const [displayText, setDisplayText] = useState(targetText);
  const displayTextRef = useRef(displayText);
  const targetTextRef = useRef(targetText);
  const rafIdRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    displayTextRef.current = displayText;
  }, [displayText]);

  useEffect(() => {
    targetTextRef.current = targetText;
  }, [targetText]);

  useEffect(() => {
    if (!enabled) {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      lastTsRef.current = null;
      setDisplayText(targetText);
      return;
    }

    if (displayTextRef.current.length > targetText.length) {
      setDisplayText(targetText);
    }

    const tick = (ts: number) => {
      const lastTs = lastTsRef.current ?? ts;
      const dt = ts - lastTs;
      lastTsRef.current = ts;

      const current = displayTextRef.current;
      const target = targetTextRef.current;

      if (current.length >= target.length) {
        rafIdRef.current = null;
        return;
      }

      const remaining = target.length - current.length;
      const ideal = Math.floor((dt * speedCharsPerSecond) / 1000);
      const toAdd = Math.min(remaining, Math.max(1, Math.min(maxCharsPerFrame, ideal)));

      const next = target.slice(0, current.length + toAdd);
      displayTextRef.current = next;
      setDisplayText(next);

      rafIdRef.current = requestAnimationFrame(tick);
    };

    if (rafIdRef.current === null) {
      lastTsRef.current = null;
      rafIdRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      lastTsRef.current = null;
    };
  }, [enabled, targetText, speedCharsPerSecond, maxCharsPerFrame]);

  return displayText;
}
