import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, create } from 'react-test-renderer';
import { useRef } from 'react';

import { useSlashCommands } from './useSlashCommands';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useSlashCommands', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancelRaf = globalThis.cancelAnimationFrame;

  beforeEach(() => {
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    };
    globalThis.cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancelRaf;
  });

  it('builds suggestions from slash commands', () => {
    let latest:
      | {
          slashState: {
            isActive: boolean;
            suggestions: string[];
          };
        }
      | undefined;

    function Test() {
      const textareaRef = useRef<HTMLTextAreaElement | null>(null);
      const hook = useSlashCommands({
        value: '/he',
        slashCommands: ['help', '/hello', 'halt'],
        onChange: () => {},
        textareaRef,
      });
      latest = { slashState: hook.slashState };
      return null;
    }

    act(() => {
      create(<Test />);
    });

    expect(latest?.slashState.isActive).toBe(true);
    expect(latest?.slashState.suggestions).toEqual(['hello', 'help']);
  });

  it('applies a slash command and focuses textarea', () => {
    const onChange = vi.fn();
    const focus = vi.fn();
    const setSelectionRange = vi.fn();

    let latest:
      | {
          applySlashCommand: (command: string) => void;
        }
      | undefined;

    function Test() {
      const textareaRef = useRef<HTMLTextAreaElement | null>({
        focus,
        setSelectionRange,
      } as unknown as HTMLTextAreaElement);
      const hook = useSlashCommands({
        value: '/he',
        slashCommands: ['help', 'hello'],
        onChange,
        textareaRef,
      });
      latest = { applySlashCommand: hook.applySlashCommand };
      return null;
    }

    act(() => {
      create(<Test />);
    });

    act(() => {
      latest?.applySlashCommand('help');
    });

    expect(onChange).toHaveBeenCalledWith('/help ');
    expect(focus).toHaveBeenCalled();
    expect(setSelectionRange).toHaveBeenCalledWith(6, 6);
  });
});
