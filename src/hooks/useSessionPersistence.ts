import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

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
}

export function useSessionPersistence(): SessionPersistenceResult {
  const initial = useMemo(() => {
    const newSessionId = String(Date.now());
    const newSession: ChatSession = {
      id: newSessionId,
      title: '新对话',
      model: DEFAULT_MODEL_ID,
    };

    return {
      sessions: [newSession],
      selectedSessionId: newSessionId,
      sessionMessages: { [newSessionId]: [] },
      sessionDrafts: { [newSessionId]: '' },
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
    if (!sessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(sessions[0]?.id ?? DEFAULT_SESSION_ID);
    }
  }, [sessions, selectedSessionId]);

  const normalizeSessionModel = useCallback(() => {
    setSessions((prev) =>
      prev.map((session) => ({
        ...session,
        model: session.model ?? DEFAULT_MODEL_ID,
      }))
    );
  }, []);

  useEffect(() => {
    normalizeSessionModel();
  }, [normalizeSessionModel]);

  return {
    sessions,
    setSessions,
    selectedSessionId,
    setSelectedSessionId,
    sessionMessages,
    setSessionMessages,
    sessionDrafts,
    setSessionDrafts,
  };
}
