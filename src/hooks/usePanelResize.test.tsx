import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, create } from 'react-test-renderer';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { usePanelResize } from './usePanelResize';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('usePanelResize', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  let listeners: Record<string, EventListener> = {};

  beforeEach(() => {
    listeners = {};
    globalThis.window = {
      addEventListener: vi.fn((event, handler) => {
        listeners[event] = handler as EventListener;
      }),
      removeEventListener: vi.fn((event) => {
        delete listeners[event];
      }),
    } as unknown as Window;
    globalThis.document = {
      body: {
        style: {
          cursor: '',
          userSelect: '',
        },
      },
    } as Document;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });

  it('clamps and updates width while dragging', () => {
    const setWidth = vi.fn();
    let handler: ((event: ReactPointerEvent<HTMLDivElement>) => void) | undefined;

    function Test() {
      handler = usePanelResize({
        isOpen: true,
        width: 300,
        setWidth,
        minWidth: 200,
        minContentWidth: 200,
        getContainerWidth: () => 600,
      });
      return null;
    }

    act(() => {
      create(<Test />);
    });

    const preventDefault = vi.fn();
    act(() => {
      handler?.({ clientX: 500, preventDefault } as ReactPointerEvent<HTMLDivElement>);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(globalThis.document?.body.style.cursor).toBe('col-resize');

    act(() => {
      listeners.pointermove?.({ clientX: 450 } as PointerEvent);
    });

    expect(setWidth).toHaveBeenCalledWith(350);

    act(() => {
      listeners.pointerup?.({} as PointerEvent);
    });

    expect(globalThis.document?.body.style.cursor).toBe('');
  });
});
