import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID } from '../constants/chat';
import i18n from '../i18n';

import type { ChatSession } from '../components/business/Sidebar/types';
import type { Message } from '../components/business/ChatMessageList/types';

export type SessionMessages = Record<string, Message[]>;
export type SessionDrafts = Record<string, string>;

const DEFAULT_SESSION_ID = '1';

function syncSessionRecord<T>(
  prev: Record<string, T>,
  sessions: ChatSession[],
  fallback: () => T,
  isValid: (value: T | undefined) => boolean
): Record<string, T> {
  let changed = false;
  const next = { ...prev };
  const sessionIds = new Set(sessions.map((session) => session.id));

  for (const sessionId of sessionIds) {
    const value = next[sessionId];
    if (!isValid(value)) {
      next[sessionId] = fallback();
      changed = true;
    }
  }

  for (const id of Object.keys(next)) {
    if (!sessionIds.has(id)) {
      delete next[id];
      changed = true;
    }
  }

  return changed ? next : prev;
}

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
      title: i18n.t('chat.newSessionTitle'),
      model: DEFAULT_MODEL_ID,
      mode: DEFAULT_MODE_ID,
    };

    return {
      sessions: [newSession],
      selectedSessionId: newSessionId,
      sessionMessages: { [newSessionId]: [] },
      sessionDrafts: { [newSessionId]: '' },
    };
  }, []);

  const [sessions, setSessions] = useState<ChatSession[]>(initial.sessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initial.selectedSessionId);
  const [sessionMessages, setSessionMessages] = useState<SessionMessages>(initial.sessionMessages);
  const [sessionDrafts, setSessionDrafts] = useState<SessionDrafts>(initial.sessionDrafts);

  useEffect(() => {
    setSessionMessages((prev) =>
      syncSessionRecord(prev, sessions, () => [], (value) => Array.isArray(value))
    );
  }, [sessions]);

  useEffect(() => {
    setSessionDrafts((prev) =>
      syncSessionRecord(prev, sessions, () => '', (value) => typeof value === 'string')
    );
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

  const normalizeSessionMode = useCallback(() => {
    setSessions((prev) =>
      prev.map((session) => ({
        ...session,
        mode: session.mode ?? DEFAULT_MODE_ID,
      }))
    );
  }, []);

  useEffect(() => {
    normalizeSessionModel();
  }, [normalizeSessionModel]);

  useEffect(() => {
    normalizeSessionMode();
  }, [normalizeSessionMode]);

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
