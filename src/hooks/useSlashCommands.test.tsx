import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, create } from 'react-test-renderer';
import { useEffect, useRef } from 'react';

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
    type LatestState = {
      slashState: {
        isActive: boolean;
        suggestions: string[];
      };
    };

    let latest: LatestState | undefined;

    const handleUpdate = (nextState: LatestState) => {
      latest = nextState;
    };

    function Test({ onUpdate }: { onUpdate: typeof handleUpdate }) {
      const textareaRef = useRef<HTMLTextAreaElement | null>(null);
      const hook = useSlashCommands({
        value: '/he',
        slashCommands: ['help', '/hello', 'halt'],
        onChange: () => {},
        textareaRef,
      });
      useEffect(() => {
        onUpdate({ slashState: hook.slashState });
      }, [hook.slashState, onUpdate]);
      return null;
    }

    act(() => {
      create(<Test onUpdate={handleUpdate} />);
    });

    expect(latest?.slashState.isActive).toBe(true);
    expect(latest?.slashState.suggestions).toEqual(['hello', 'help']);
  });

  it('returns inactive state when commands are empty', () => {
    type LatestState = {
      slashState: {
        isActive: boolean;
        suggestions: string[];
      };
      leadingSlashToken: { command: string; tail: string } | null;
    };

    let latest: LatestState | undefined;

    const handleUpdate = (nextState: LatestState) => {
      latest = nextState;
    };

    function Test({ onUpdate }: { onUpdate: typeof handleUpdate }) {
      const textareaRef = useRef<HTMLTextAreaElement | null>(null);
      const hook = useSlashCommands({
        value: 'hello',
        slashCommands: [],
        onChange: () => {},
        textareaRef,
      });
      useEffect(() => {
        onUpdate({ slashState: hook.slashState, leadingSlashToken: hook.leadingSlashToken });
      }, [hook.leadingSlashToken, hook.slashState, onUpdate]);
      return null;
    }

    act(() => {
      create(<Test onUpdate={handleUpdate} />);
    });

    expect(latest?.slashState.isActive).toBe(false);
    expect(latest?.slashState.suggestions).toEqual([]);
    expect(latest?.leadingSlashToken).toBeNull();
  });

  it('exposes helpers for slash command parsing', () => {
    type LatestState = {
      leadingSlashToken: { command: string; tail: string } | null;
      stripCommandSeparator: (tail: string) => string;
      buildSlashCommandValue: (command: string, tail: string) => string;
      normalizedSlashCommands: string[];
    };

    let latest: LatestState | undefined;

    const handleUpdate = (nextState: LatestState) => {
      latest = nextState;
    };

    function Test({ onUpdate }: { onUpdate: typeof handleUpdate }) {
      const textareaRef = useRef<HTMLTextAreaElement | null>(null);
      const hook = useSlashCommands({
        value: '  /help rest',
        slashCommands: ['help', '/help', ' help '],
        onChange: () => {},
        textareaRef,
      });
      useEffect(() => {
        onUpdate({
          leadingSlashToken: hook.leadingSlashToken,
          stripCommandSeparator: hook.stripCommandSeparator,
          buildSlashCommandValue: hook.buildSlashCommandValue,
          normalizedSlashCommands: hook.normalizedSlashCommands,
        });
      }, [
        hook.buildSlashCommandValue,
        hook.leadingSlashToken,
        hook.normalizedSlashCommands,
        hook.stripCommandSeparator,
        onUpdate,
      ]);
      return null;
    }

    act(() => {
      create(<Test onUpdate={handleUpdate} />);
    });

    expect(latest?.leadingSlashToken).toEqual({ command: 'help', tail: ' rest' });
    expect(latest?.stripCommandSeparator(' rest')).toBe('rest');
    expect(latest?.stripCommandSeparator('rest')).toBe('rest');
    expect(latest?.buildSlashCommandValue('help', '')).toBe('/help');
    expect(latest?.buildSlashCommandValue('help', 'rest')).toBe('/help rest');
    expect(latest?.buildSlashCommandValue('help', ' rest')).toBe('/help rest');
    expect(latest?.normalizedSlashCommands).toEqual(['help']);
  });

  it('ignores suggestions when input has spaces after slash', () => {
    type LatestState = { slashState: { isActive: boolean; suggestions: string[] } };
    let latest: LatestState | undefined;
    const handleUpdate = (nextState: LatestState) => {
      latest = nextState;
    };

    function Test({ onUpdate }: { onUpdate: typeof handleUpdate }) {
      const textareaRef = useRef<HTMLTextAreaElement | null>(null);
      const hook = useSlashCommands({
        value: '/help me',
        slashCommands: ['help'],
        onChange: () => {},
        textareaRef,
      });
      useEffect(() => {
        onUpdate({ slashState: hook.slashState });
      }, [hook.slashState, onUpdate]);
      return null;
    }

    act(() => {
      create(<Test onUpdate={handleUpdate} />);
    });

    expect(latest?.slashState.isActive).toBe(false);
    expect(latest?.slashState.suggestions).toEqual([]);
  });

  it('applies a slash command and focuses textarea', () => {
    const onChange = vi.fn();
    const focus = vi.fn();
    const setSelectionRange = vi.fn();

    type LatestApplyState = {
      applySlashCommand: (command: string) => void;
    };

    let latest: LatestApplyState | undefined;

    const handleUpdate = (nextState: LatestApplyState) => {
      latest = nextState;
    };

    function Test({ onUpdate }: { onUpdate: typeof handleUpdate }) {
      const textareaRef = useRef<HTMLTextAreaElement | null>({
        focus,
        setSelectionRange,
      } as unknown as HTMLTextAreaElement);
      const hook = useSlashCommands({
        value: '  /he',
        slashCommands: ['help', 'hello'],
        onChange,
        textareaRef,
      });
      useEffect(() => {
        onUpdate({ applySlashCommand: hook.applySlashCommand });
      }, [hook.applySlashCommand, onUpdate]);
      return null;
    }

    act(() => {
      create(<Test onUpdate={handleUpdate} />);
    });

    act(() => {
      latest?.applySlashCommand('help');
    });

    expect(onChange).toHaveBeenCalledWith('  /help ');
    expect(focus).toHaveBeenCalled();
    expect(setSelectionRange).toHaveBeenCalledWith(8, 8);
  });
});
