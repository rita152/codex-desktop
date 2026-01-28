import { useMemo } from 'react';

import type { ChatSession } from '../components/business/Sidebar/types';
import type { Message } from '../components/business/ChatMessageList/types';
import type { SelectOption } from '../types/options';
import type { SessionNotice } from './useSessionMeta';

type OptionsCache = {
  options: SelectOption[] | null;
  currentId?: string;
};

type UseSessionViewStateArgs = {
  sessions: ChatSession[];
  selectedSessionId: string;
  sessionMessages: Record<string, Message[]>;
  sessionDrafts: Record<string, string>;
  sessionNotices: Record<string, SessionNotice>;
  sessionModeOptions: Record<string, SelectOption[]>;
  sessionModelOptions: Record<string, SelectOption[]>;
  sessionSlashCommands: Record<string, string[]>;
  modelCache: OptionsCache;
  isGeneratingBySession: Record<string, boolean>;
  terminalBySession: Record<string, string>;
  defaultModelId: string;
  defaultModeId: string;
  defaultSlashCommands: string[];
};

export function useSessionViewState({
  sessions,
  selectedSessionId,
  sessionMessages,
  sessionDrafts,
  sessionNotices,
  sessionModeOptions,
  sessionModelOptions,
  sessionSlashCommands,
  modelCache,
  isGeneratingBySession,
  terminalBySession,
  defaultModelId,
  defaultModeId,
  defaultSlashCommands,
}: UseSessionViewStateArgs) {
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId),
    [sessions, selectedSessionId]
  );
  const messages = useMemo(
    () => sessionMessages[selectedSessionId] ?? [],
    [sessionMessages, selectedSessionId]
  );
  const draftMessage = sessionDrafts[selectedSessionId] ?? '';
  const selectedModel = activeSession?.model ?? defaultModelId;
  const selectedMode = activeSession?.mode ?? defaultModeId;
  const selectedCwd = activeSession?.cwd;
  const sessionNotice = sessionNotices[selectedSessionId] ?? null;
  const agentOptions = useMemo(() => {
    const fromSession = sessionModeOptions[selectedSessionId];
    return fromSession?.length ? fromSession : undefined;
  }, [selectedSessionId, sessionModeOptions]);
  const modelOptions = useMemo(() => {
    const fromSession = sessionModelOptions[selectedSessionId];
    if (fromSession?.length) return fromSession;
    return modelCache.options ?? [];
  }, [modelCache.options, selectedSessionId, sessionModelOptions]);
  const slashCommands = useMemo(() => {
    const fromSession = sessionSlashCommands[selectedSessionId] ?? [];
    const merged = new Set([...defaultSlashCommands, ...fromSession]);
    return Array.from(merged).sort();
  }, [defaultSlashCommands, selectedSessionId, sessionSlashCommands]);
  const isGenerating = isGeneratingBySession[selectedSessionId] ?? false;
  const cwdLocked = messages.length > 0;
  const activeTerminalId = selectedSessionId ? terminalBySession[selectedSessionId] : undefined;

  return {
    activeSession,
    messages,
    draftMessage,
    selectedModel,
    selectedMode,
    selectedCwd,
    sessionNotice,
    agentOptions,
    modelOptions,
    slashCommands,
    isGenerating,
    cwdLocked,
    activeTerminalId,
  };
}
