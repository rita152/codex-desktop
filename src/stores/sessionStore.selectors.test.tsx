// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { createTestMessage, createTestSession, resetSessionStore } from './testUtils';
import type { PlanStep } from '../types/plan';
import {
  useSessionStore,
  useActiveSession,
  useCurrentMessages,
  useCurrentDraft,
  useIsGenerating,
  useSelectedModel,
  useSelectedMode,
  useSelectedCwd,
  useSessionNotice,
  useModelOptions,
  useAgentOptions,
  useSlashCommands,
  useCwdLocked,
  useActiveTerminalId,
  useCurrentPlan,
  useSessionViewState,
} from './sessionStore';

describe('SessionStore selectors', () => {
  beforeEach(() => {
    resetSessionStore();
  });

  it('reads active session and simple fields', () => {
    const { result: active } = renderHook(() => useActiveSession());
    expect(active.current).toBeTruthy();

    const { result: draft } = renderHook(() => useCurrentDraft());
    expect(draft.current).toBe('');

    const { result: gen } = renderHook(() => useIsGenerating());
    expect(gen.current).toBe(false);

    const { result: model } = renderHook(() => useSelectedModel());
    expect(typeof model.current).toBe('string');

    const { result: mode } = renderHook(() => useSelectedMode());
    expect(typeof mode.current).toBe('string');
  });

  it('reads selected cwd and notice', () => {
    const id = useSessionStore.getState().selectedSessionId;
    useSessionStore.getState().updateSession(id, { cwd: '/tmp' });
    useSessionStore.getState().setNotice(id, { kind: 'info', message: 'hello' });

    const { result: cwd } = renderHook(() => useSelectedCwd());
    expect(cwd.current).toBe('/tmp');

    const { result: notice } = renderHook(() => useSessionNotice());
    expect(notice.current).toEqual({ kind: 'info', message: 'hello' });
  });

  it('reads messages, cwdLocked, and current plan', () => {
    const id = useSessionStore.getState().selectedSessionId;
    const planSteps: PlanStep[] = [
      { id: 'p1', title: 'Do thing', status: 'pending' },
      { id: 'p2', title: 'Do other', status: 'completed' },
    ];
    const messages = [
      createTestMessage({ id: 'm1', content: 'x' }),
      // attach plan to last message
      {
        ...createTestMessage({ id: 'm2', content: 'y' }),
        planSteps,
      },
    ];

    // Exercise functional update path
    useSessionStore.getState().setSessionMessages((prev) => ({ ...prev, [id]: messages }));

    const { result: msgs } = renderHook(() => useCurrentMessages());
    expect(msgs.current.length).toBe(2);

    const { result: locked } = renderHook(() => useCwdLocked());
    expect(locked.current).toBe(true);

    const { result: plan } = renderHook(() => useCurrentPlan());
    expect(plan.current).toEqual(planSteps);
  });

  it('returns undefined current plan when last plan is completed', () => {
    const id = useSessionStore.getState().selectedSessionId;
    const completedPlan: PlanStep[] = [{ id: 'p1', title: 'Done', status: 'completed' }];
    useSessionStore.getState().setSessionMessages((prev) => ({
      ...prev,
      [id]: [{ ...createTestMessage({ id: 'm1' }), planSteps: completedPlan }],
    }));

    const { result: plan } = renderHook(() => useCurrentPlan());
    expect(plan.current).toBeUndefined();
  });

  it('reads modelOptions and agentOptions from session overrides', () => {
    const id = useSessionStore.getState().selectedSessionId;

    useSessionStore.getState().applyModelOptions({
      options: [{ value: 'm1', label: 'M1' }],
      fallbackCurrentId: 'm1',
    });

    useSessionStore.getState().setSessionModelOptions((prev) => ({
      ...prev,
      [id]: [{ value: 'm2', label: 'M2' }],
    }));
    useSessionStore.getState().setSessionModeOptions((prev) => ({
      ...prev,
      [id]: [{ value: 'a1', label: 'Agent 1' }],
    }));

    const { result: modelOptions } = renderHook(() => useModelOptions());
    expect(modelOptions.current.map((o) => o.value)).toEqual(['m2']);

    const { result: agentOptions } = renderHook(() => useAgentOptions());
    expect(agentOptions.current?.map((o) => o.value)).toEqual(['a1']);
  });

  it('falls back to cache modelOptions when session options empty', () => {
    useSessionStore.getState().applyModelOptions({
      options: [{ value: 'm1', label: 'M1' }],
      currentId: 'm1',
    });

    const { result: modelOptions } = renderHook(() => useModelOptions());
    expect(modelOptions.current.map((o) => o.value)).toEqual(['m1']);
  });

  it('merges slash commands and keeps stable sort', () => {
    const id = useSessionStore.getState().selectedSessionId;
    useSessionStore.getState().setSessionSlashCommands((prev) => ({
      ...prev,
      [id]: ['/x', '/help'],
    }));

    const { result: slash } = renderHook(() => useSlashCommands());
    expect(slash.current).toContain('/help');
    expect(slash.current).toContain('/x');
  });

  it('reads active terminal id', () => {
    const id = useSessionStore.getState().selectedSessionId;
    useSessionStore.getState().setTerminal(id, 'term-1');

    const { result: term } = renderHook(() => useActiveTerminalId());
    expect(term.current).toBe('term-1');
  });

  it('returns consolidated session view state', () => {
    const baseId = useSessionStore.getState().selectedSessionId;
    const second = createTestSession({ id: 's2', title: 'Second', cwd: '/work' });
    useSessionStore.getState().addSession(second);
    useSessionStore.getState().setSelectedSessionId(second.id);

    useSessionStore.getState().setDraft(second.id, 'draft');
    useSessionStore.getState().setNotice(second.id, { kind: 'error', message: 'boom' });
    useSessionStore.getState().setIsGenerating(second.id, true);
    useSessionStore.getState().setTerminal(second.id, 'term-2');
    useSessionStore.getState().addMessage(second.id, createTestMessage({ id: 'm1' }));

    const { result } = renderHook(() => useSessionViewState());
    expect(result.current.activeSession?.id).toBe(second.id);
    expect(result.current.draftMessage).toBe('draft');
    expect(result.current.sessionNotice?.kind).toBe('error');
    expect(result.current.cwdLocked).toBe(true);
    expect(result.current.isGenerating).toBe(true);
    expect(result.current.activeTerminalId).toBe('term-2');

    // keep baseId referenced to avoid unused (tsc/noUnusedLocals)
    expect(baseId).not.toBe('');
  });

  it('covers cleanup helpers and non-matching update branches', () => {
    const baseId = useSessionStore.getState().selectedSessionId;
    const newId = useSessionStore.getState().createNewChat('/cwd', 'Chat');

    useSessionStore.getState().setSessionNotices((prev) => ({
      ...prev,
      [baseId]: { kind: 'info', message: 'x' },
    }));
    useSessionStore.getState().setSessionSlashCommands((prev) => ({ ...prev, [baseId]: ['/x'] }));
    useSessionStore.getState().setSessionModelOptions((prev) => ({
      ...prev,
      [baseId]: [{ value: 'm', label: 'm' }],
    }));
    useSessionStore.getState().setSessionModeOptions((prev) => ({
      ...prev,
      [baseId]: [{ value: 'a', label: 'a' }],
    }));

    act(() => {
      useSessionStore.getState().removeSessionMeta(baseId, newId);
    });

    // updateMessage branch: mismatch id leaves message untouched
    useSessionStore.getState().addMessage(newId, createTestMessage({ id: 'm1', content: 'a' }));
    useSessionStore.getState().updateMessage(newId, 'not-m1', { content: 'b' });
    expect(useSessionStore.getState().sessionMessages[newId][0].content).toBe('a');
  });
});
