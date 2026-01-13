import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { loadSessionState, saveSessionState } from '../api/storage';

import type { ChatSession } from '../components/business/Sidebar/types';
import type { Message } from '../components/business/ChatMessageList/types';

export type SessionMessages = Record<string, Message[]>;

const DEFAULT_SESSION_ID = '1';
const DEFAULT_SESSIONS: ChatSession[] = [{ id: DEFAULT_SESSION_ID, title: '新对话' }];
const DEFAULT_MESSAGES: SessionMessages = { [DEFAULT_SESSION_ID]: [] };

export interface SessionPersistenceResult {
  sessions: ChatSession[];
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
  selectedSessionId: string;
  setSelectedSessionId: Dispatch<SetStateAction<string>>;
  sessionMessages: SessionMessages;
  setSessionMessages: Dispatch<SetStateAction<SessionMessages>>;
  restoredSessionIds: Set<string>;
  clearRestoredSession: (sessionId: string) => void;
  markRestoredSession: (sessionId: string) => void;
}

export function useSessionPersistence(): SessionPersistenceResult {
  const initial = useMemo(() => loadSessionState(), []);

  const [sessions, setSessions] = useState<ChatSession[]>(() => initial?.sessions ?? DEFAULT_SESSIONS);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    () => initial?.selectedSessionId ?? DEFAULT_SESSION_ID
  );
  const [sessionMessages, setSessionMessages] = useState<SessionMessages>(
    () => initial?.sessionMessages ?? DEFAULT_MESSAGES
  );
  const [restoredSessionIds, setRestoredSessionIds] = useState<Set<string>>(
    () => new Set(initial?.sessions.map((session) => session.id) ?? [])
  );

  useEffect(() => {
    setSessionMessages((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const session of sessions) {
        if (!next[session.id]) {
          next[session.id] = [];
          changed = true;
        }
      }

      for (const id of Object.keys(next)) {
        if (!sessions.some((session) => session.id === id)) {
          delete next[id];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [sessions]);

  useEffect(() => {
    setRestoredSessionIds((prev) => {
      const next = new Set(
        [...prev].filter((id) => sessions.some((session) => session.id === id))
      );
      return next.size === prev.size ? prev : next;
    });
  }, [sessions]);

  useEffect(() => {
    if (!sessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(sessions[0]?.id ?? DEFAULT_SESSION_ID);
    }
  }, [sessions, selectedSessionId]);

  useEffect(() => {
    saveSessionState({ sessions, selectedSessionId, sessionMessages });
  }, [sessions, selectedSessionId, sessionMessages]);

  const clearRestoredSession = useCallback((sessionId: string) => {
    setRestoredSessionIds((prev) => {
      if (!prev.has(sessionId)) return prev;
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const markRestoredSession = useCallback((sessionId: string) => {
    setRestoredSessionIds((prev) => {
      if (prev.has(sessionId)) return prev;
      const next = new Set(prev);
      next.add(sessionId);
      return next;
    });
  }, []);

  return {
    sessions,
    setSessions,
    selectedSessionId,
    setSelectedSessionId,
    sessionMessages,
    setSessionMessages,
    restoredSessionIds,
    clearRestoredSession,
    markRestoredSession,
  };
}
