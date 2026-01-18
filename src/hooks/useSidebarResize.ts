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

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !sidebarRef.current) return;
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - sidebarRect.left;
      setWidth(newWidth);
    },
    [isDragging, setWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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
