import { useCallback, useState } from 'react';

import type { SelectOption } from '../types/options';

export interface SessionNotice {
  kind: 'error' | 'info';
  message: string;
}

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
  const [sessionNotices, setSessionNotices] = useState<Record<string, SessionNotice | undefined>>(
    {}
  );
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
  }, []);

  return {
    sessionNotices,
    sessionSlashCommands,
    sessionModelOptions,
    sessionModeOptions,
    setSessionNotices,
    setSessionSlashCommands,
    setSessionModelOptions,
    setSessionModeOptions,
    clearSessionNotice,
    removeSessionMeta,
  };
}
