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
  const clampWidth = useCallback(
    (nextWidth: number) => {
      const containerWidth = getContainerWidth();
      const maxWidth = containerWidth
        ? Math.max(minWidth, containerWidth - minContentWidth)
        : nextWidth;
      return Math.min(Math.max(nextWidth, minWidth), maxWidth);
    },
    [getContainerWidth, minContentWidth, minWidth]
  );

  return useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isOpen) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = startX - moveEvent.clientX;
        setWidth(clampWidth(startWidth + delta));
      };
      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [clampWidth, isOpen, setWidth, width]
  );
}
