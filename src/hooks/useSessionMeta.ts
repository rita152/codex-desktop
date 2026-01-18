import { useCallback, useState } from 'react';

import type { SelectOption } from '../components/ui/data-entry/Select/types';

export interface SessionNotice {
  kind: 'error' | 'info';
  message: string;
}
export type SessionTokenUsage = Record<
  string,
  {
    totalTokens: number;
    lastTokens?: number;
    contextWindow?: number | null;
    percentRemaining?: number | null;
  }
>;

function omitSessionKeys<T extends Record<string, unknown>>(
  prev: T,
  sessionId: string,
  resetSessionId?: string
): T {
  const hasSession = sessionId in prev;
  const hasReset = resetSessionId ? resetSessionId in prev : false;
  if (!hasSession && !hasReset) return prev;

  const next = { ...prev };
  delete next[sessionId];
  if (resetSessionId) delete next[resetSessionId];
  return next;
}

export function useSessionMeta() {
  const [sessionTokenUsage, setSessionTokenUsage] = useState<SessionTokenUsage>({});
  const [sessionNotices, setSessionNotices] = useState<Record<string, SessionNotice>>({});
  const [sessionSlashCommands, setSessionSlashCommands] = useState<Record<string, string[]>>({});
  const [sessionModelOptions, setSessionModelOptions] = useState<Record<string, SelectOption[]>>(
    {}
  );
  const [sessionModeOptions, setSessionModeOptions] = useState<Record<string, SelectOption[]>>({});

  const clearSessionNotice = useCallback((sessionId: string) => {
    setSessionNotices((prev) => omitSessionKeys(prev, sessionId));
  }, []);

  const removeSessionMeta = useCallback((sessionId: string, resetSessionId?: string) => {
    setSessionNotices((prev) => omitSessionKeys(prev, sessionId, resetSessionId));
    setSessionSlashCommands((prev) => omitSessionKeys(prev, sessionId, resetSessionId));
    setSessionModelOptions((prev) => omitSessionKeys(prev, sessionId, resetSessionId));
    setSessionModeOptions((prev) => omitSessionKeys(prev, sessionId, resetSessionId));
    setSessionTokenUsage((prev) => omitSessionKeys(prev, sessionId, resetSessionId));
  }, []);

  return {
    sessionTokenUsage,
    sessionNotices,
    sessionSlashCommands,
    sessionModelOptions,
    sessionModeOptions,
    setSessionTokenUsage,
    setSessionNotices,
    setSessionSlashCommands,
    setSessionModelOptions,
    setSessionModeOptions,
    clearSessionNotice,
    removeSessionMeta,
  };
}
