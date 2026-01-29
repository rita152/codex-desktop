/**
 * Session Store Sync Hook
 *
 * Synchronizes state from SessionContext to SessionStore.
 * This allows components to use fine-grained store selectors
 * while keeping the complex side-effect logic in SessionContext.
 */

import { useEffect } from 'react';
import { useSessionStore } from './sessionStore';

import type { ChatSession } from '../types/session';
import type { Message } from '../types/message';
import type { SelectOption } from '../types/options';

interface SessionNotice {
  kind: 'error' | 'info';
  message: string;
}

interface UseSessionStoreSyncArgs {
  sessions: ChatSession[];
  selectedSessionId: string;
  sessionMessages: Record<string, Message[]>;
  sessionDrafts: Record<string, string>;
  sessionNotices: Record<string, SessionNotice | undefined>;
  sessionSlashCommands: Record<string, string[]>;
  sessionModelOptions: Record<string, SelectOption[]>;
  sessionModeOptions: Record<string, SelectOption[]>;
  modelCache: { options: SelectOption[] | null; currentId?: string };
  isGeneratingBySession: Record<string, boolean>;
  terminalBySession: Record<string, string>;
}

/**
 * Sync session state from Context to Store.
 * Call this in SessionProvider to keep the store in sync.
 */
export function useSessionStoreSync({
  sessions,
  selectedSessionId,
  sessionMessages,
  sessionDrafts,
  sessionNotices,
  sessionSlashCommands,
  sessionModelOptions,
  sessionModeOptions,
  modelCache,
  isGeneratingBySession,
  terminalBySession,
}: UseSessionStoreSyncArgs): void {
  const store = useSessionStore;

  // Sync sessions
  useEffect(() => {
    store.setState({ sessions });
  }, [sessions]);

  // Sync selected session ID
  useEffect(() => {
    store.setState({ selectedSessionId });
  }, [selectedSessionId]);

  // Sync messages
  useEffect(() => {
    store.setState({ sessionMessages });
  }, [sessionMessages]);

  // Sync drafts
  useEffect(() => {
    store.setState({ sessionDrafts });
  }, [sessionDrafts]);

  // Sync notices
  useEffect(() => {
    store.setState({ sessionNotices });
  }, [sessionNotices]);

  // Sync slash commands
  useEffect(() => {
    store.setState({ sessionSlashCommands });
  }, [sessionSlashCommands]);

  // Sync model options
  useEffect(() => {
    store.setState({ sessionModelOptions });
  }, [sessionModelOptions]);

  // Sync mode options
  useEffect(() => {
    store.setState({ sessionModeOptions });
  }, [sessionModeOptions]);

  // Sync model cache
  useEffect(() => {
    store.setState({ modelCache });
  }, [modelCache]);

  // Sync generating state
  useEffect(() => {
    store.setState({ isGeneratingBySession });
  }, [isGeneratingBySession]);

  // Sync terminal state
  useEffect(() => {
    store.setState({ terminalBySession });
  }, [terminalBySession]);
}
