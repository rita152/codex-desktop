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

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = startX - moveEvent.clientX;
        setWidth(clampWidth(startWidth + delta));
      };
      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
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
