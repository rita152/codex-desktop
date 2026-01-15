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

export function useSessionMeta() {
  const [sessionTokenUsage, setSessionTokenUsage] = useState<SessionTokenUsage>({});
  const [sessionNotices, setSessionNotices] = useState<Record<string, SessionNotice>>({});
  const [sessionSlashCommands, setSessionSlashCommands] = useState<Record<string, string[]>>({});
  const [sessionModelOptions, setSessionModelOptions] = useState<Record<string, SelectOption[]>>(
    {}
  );
  const [sessionModeOptions, setSessionModeOptions] = useState<Record<string, SelectOption[]>>({});

  const clearSessionNotice = useCallback((sessionId: string) => {
    setSessionNotices((prev) => {
      if (!prev[sessionId]) return prev;
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  }, []);

  const removeSessionMeta = useCallback((sessionId: string, resetSessionId?: string) => {
    setSessionNotices((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      if (resetSessionId) delete next[resetSessionId];
      return next;
    });
    setSessionSlashCommands((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      if (resetSessionId) delete next[resetSessionId];
      return next;
    });
    setSessionModelOptions((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      if (resetSessionId) delete next[resetSessionId];
      return next;
    });
    setSessionModeOptions((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      if (resetSessionId) delete next[resetSessionId];
      return next;
    });
    setSessionTokenUsage((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      if (resetSessionId) delete next[resetSessionId];
      return next;
    });
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
