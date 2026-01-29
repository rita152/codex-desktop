import { useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type UsePanelResizeArgs = {
  isOpen: boolean;
  width: number;
  setWidth: (nextWidth: number) => void;
  minWidth: number;
  minContentWidth: number;
  getContainerWidth: () => number;
};

export function usePanelResize({
  isOpen,
  width,
  setWidth,
  minWidth,
  minContentWidth,
  getContainerWidth,
}: UsePanelResizeArgs) {
  return useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isOpen) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = width;
      const startContainerWidth = getContainerWidth();
      const maxWidth = startContainerWidth
        ? Math.max(minWidth, startContainerWidth - minContentWidth)
        : null;
      const clampWidth = (nextWidth: number) => {
        if (maxWidth === null) return nextWidth;
        return Math.min(Math.max(nextWidth, minWidth), maxWidth);
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      // RAF throttling for smooth resize
      let rafId: number | null = null;
      let pendingWidth: number | null = null;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = startX - moveEvent.clientX;
        pendingWidth = clampWidth(startWidth + delta);

        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            if (pendingWidth !== null) {
              setWidth(pendingWidth);
            }
          });
        }
      };
      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        // Apply final width if pending
        if (pendingWidth !== null) {
          setWidth(pendingWidth);
        }
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [getContainerWidth, isOpen, minContentWidth, minWidth, setWidth, width]
  );
}
