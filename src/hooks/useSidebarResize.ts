import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';

type UseSidebarResizeArgs = {
  width?: number;
  onWidthChange?: (width: number) => void;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
};

export function useSidebarResize({
  width: controlledWidth,
  onWidthChange,
  minWidth,
  maxWidth,
  defaultWidth,
}: UseSidebarResizeArgs) {
  const [internalWidth, setInternalWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const width = controlledWidth ?? internalWidth;

  const setWidth = useCallback(
    (nextWidth: number) => {
      const clampedWidth = Math.min(Math.max(nextWidth, minWidth), maxWidth);
      if (onWidthChange) {
        onWidthChange(clampedWidth);
      } else {
        setInternalWidth(clampedWidth);
      }
    },
    [maxWidth, minWidth, onWidthChange]
  );

  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // RAF throttling for smooth resize
  const rafIdRef = useRef<number | null>(null);
  const pendingWidthRef = useRef<number | null>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !sidebarRef.current) return;
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      pendingWidthRef.current = e.clientX - sidebarRect.left;

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (pendingWidthRef.current !== null) {
            setWidth(pendingWidthRef.current);
          }
        });
      }
    },
    [isDragging, setWidth]
  );

  const handleMouseUp = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // Apply final width if pending
    if (pendingWidthRef.current !== null) {
      setWidth(pendingWidthRef.current);
      pendingWidthRef.current = null;
    }
    setIsDragging(false);
  }, [setWidth]);

  const handleResizeKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 40 : 10;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setWidth(width - step);
          break;
        case 'ArrowRight':
          e.preventDefault();
          setWidth(width + step);
          break;
        case 'Home':
          e.preventDefault();
          setWidth(minWidth);
          break;
        case 'End':
          e.preventDefault();
          setWidth(maxWidth);
          break;
      }
    },
    [maxWidth, minWidth, setWidth, width]
  );

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [handleMouseMove, handleMouseUp, isDragging]);

  return {
    width,
    isDragging,
    sidebarRef,
    handleMouseDown,
    handleResizeKeyDown,
  };
}
