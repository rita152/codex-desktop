import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, create } from 'react-test-renderer';
import { useEffect } from 'react';
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
    } as unknown as Window & typeof globalThis;
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

    const handleReady = (nextHandler: (event: ReactPointerEvent<HTMLDivElement>) => void) => {
      handler = nextHandler;
    };

    function Test({ onReady }: { onReady: typeof handleReady }) {
      const nextHandler = usePanelResize({
        isOpen: true,
        width: 300,
        setWidth,
        minWidth: 200,
        minContentWidth: 200,
        getContainerWidth: () => 600,
      });
      useEffect(() => {
        onReady(nextHandler);
      }, [nextHandler, onReady]);
      return null;
    }

    act(() => {
      create(<Test onReady={handleReady} />);
    });

    const preventDefault = vi.fn();
    act(() => {
      handler?.({ clientX: 500, preventDefault } as unknown as ReactPointerEvent<HTMLDivElement>);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(globalThis.document?.body.style.cursor).toBe('col-resize');

    act(() => {
      listeners.pointermove?.({ clientX: 450 } as unknown as PointerEvent);
    });

    expect(setWidth).toHaveBeenCalledWith(350);

    act(() => {
      listeners.pointerup?.({} as unknown as PointerEvent);
    });

    expect(globalThis.document?.body.style.cursor).toBe('');
  });

  it('does nothing when the panel is closed', () => {
    const setWidth = vi.fn();
    let handler: ((event: ReactPointerEvent<HTMLDivElement>) => void) | undefined;

    const handleReady = (nextHandler: (event: ReactPointerEvent<HTMLDivElement>) => void) => {
      handler = nextHandler;
    };

    function Test({ onReady }: { onReady: typeof handleReady }) {
      const nextHandler = usePanelResize({
        isOpen: false,
        width: 300,
        setWidth,
        minWidth: 200,
        minContentWidth: 200,
        getContainerWidth: () => 600,
      });
      useEffect(() => {
        onReady(nextHandler);
      }, [nextHandler, onReady]);
      return null;
    }

    act(() => {
      create(<Test onReady={handleReady} />);
    });

    const preventDefault = vi.fn();
    act(() => {
      handler?.({ clientX: 400, preventDefault } as unknown as ReactPointerEvent<HTMLDivElement>);
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(setWidth).not.toHaveBeenCalled();
    expect(Object.keys(listeners)).toHaveLength(0);
  });

  it('clamps width when container width is zero', () => {
    const setWidth = vi.fn();
    let handler: ((event: ReactPointerEvent<HTMLDivElement>) => void) | undefined;

    const handleReady = (nextHandler: (event: ReactPointerEvent<HTMLDivElement>) => void) => {
      handler = nextHandler;
    };

    function Test({ onReady }: { onReady: typeof handleReady }) {
      const nextHandler = usePanelResize({
        isOpen: true,
        width: 300,
        setWidth,
        minWidth: 200,
        minContentWidth: 200,
        getContainerWidth: () => 0,
      });
      useEffect(() => {
        onReady(nextHandler);
      }, [nextHandler, onReady]);
      return null;
    }

    act(() => {
      create(<Test onReady={handleReady} />);
    });

    const preventDefault = vi.fn();
    act(() => {
      handler?.({ clientX: 500, preventDefault } as unknown as ReactPointerEvent<HTMLDivElement>);
    });

    act(() => {
      listeners.pointermove?.({ clientX: 600 } as unknown as PointerEvent);
    });

    expect(setWidth).toHaveBeenCalledWith(200);
  });
});
