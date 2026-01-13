import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { loadSessionState, saveSessionState } from '../api/storage';

import type { ChatSession } from '../components/business/Sidebar/types';
import type { Message } from '../components/business/ChatMessageList/types';

export type SessionMessages = Record<string, Message[]>;

const DEFAULT_SESSION_ID = '1';

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
  const initial = useMemo(() => {
    const loaded = loadSessionState();
    const restoredSessions = loaded?.sessions ?? [];
    const restoredMessages = loaded?.sessionMessages ?? {};
    let newSessionId = String(Date.now());
    if (restoredSessions.some((session) => session.id === newSessionId)) {
      newSessionId = `${newSessionId}-${Math.random().toString(16).slice(2)}`;
    }
    const newSession: ChatSession = { id: newSessionId, title: '新对话' };

    return {
      sessions: [newSession, ...restoredSessions],
      selectedSessionId: newSessionId,
      sessionMessages: { ...restoredMessages, [newSessionId]: [] },
      restoredSessionIds: new Set(restoredSessions.map((session) => session.id)),
    };
  }, []);

  const [sessions, setSessions] = useState<ChatSession[]>(initial.sessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    initial.selectedSessionId
  );
  const [sessionMessages, setSessionMessages] = useState<SessionMessages>(
    initial.sessionMessages
  );
  const [restoredSessionIds, setRestoredSessionIds] = useState<Set<string>>(
    initial.restoredSessionIds
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
