import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { loadSessionState, saveSessionState } from '../api/storage';
import { DEFAULT_MODEL_ID } from '../constants/chat';

import type { ChatSession } from '../components/business/Sidebar/types';
import type { Message } from '../components/business/ChatMessageList/types';

export type SessionMessages = Record<string, Message[]>;
export type SessionDrafts = Record<string, string>;

const DEFAULT_SESSION_ID = '1';

export interface SessionPersistenceResult {
  sessions: ChatSession[];
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
  selectedSessionId: string;
  setSelectedSessionId: Dispatch<SetStateAction<string>>;
  sessionMessages: SessionMessages;
  setSessionMessages: Dispatch<SetStateAction<SessionMessages>>;
  sessionDrafts: SessionDrafts;
  setSessionDrafts: Dispatch<SetStateAction<SessionDrafts>>;
  restoredSessionIds: Set<string>;
  clearRestoredSession: (sessionId: string) => void;
  markRestoredSession: (sessionId: string) => void;
}

export function useSessionPersistence(): SessionPersistenceResult {
  const initial = useMemo(() => {
    const loaded = loadSessionState();
    const restoredSessions = (loaded?.sessions ?? []).map((session) => ({
      ...session,
      model: session.model ?? DEFAULT_MODEL_ID,
    }));
    const restoredMessages = loaded?.sessionMessages ?? {};
    const restoredDrafts = loaded?.sessionDrafts ?? {};
    let newSessionId = String(Date.now());
    if (restoredSessions.some((session) => session.id === newSessionId)) {
      newSessionId = `${newSessionId}-${Math.random().toString(16).slice(2)}`;
    }
    const newSession: ChatSession = {
      id: newSessionId,
      title: '新对话',
      model: DEFAULT_MODEL_ID,
    };

    return {
      sessions: [newSession, ...restoredSessions],
      selectedSessionId: newSessionId,
      sessionMessages: { ...restoredMessages, [newSessionId]: [] },
      sessionDrafts: { ...restoredDrafts, [newSessionId]: '' },
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
  const [sessionDrafts, setSessionDrafts] = useState<SessionDrafts>(
    initial.sessionDrafts
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
    setSessionDrafts((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const session of sessions) {
        if (typeof next[session.id] !== 'string') {
          next[session.id] = '';
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
    saveSessionState({ sessions, selectedSessionId, sessionMessages, sessionDrafts });
  }, [sessions, selectedSessionId, sessionMessages, sessionDrafts]);

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
    sessionDrafts,
    setSessionDrafts,
    restoredSessionIds,
    clearRestoredSession,
    markRestoredSession,
  };
}
