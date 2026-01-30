import { open } from '@tauri-apps/plugin-dialog';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useSessionStore } from '../stores/sessionStore';
import { useRemoteCwdPicker } from './useRemoteCwdPicker';
import { devDebug } from '../utils/logger';
import { formatError } from '../utils/codexParsing';
import { isRemotePath } from '../utils/remotePath';

import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import type { ChatSession } from '../types/session';
import type { SessionNotice } from './useSessionMeta';

// Legacy interface for backward compatibility with SessionContext
type UseFileAndCwdActionsLegacyArgs = {
  t: TFunction;
  selectedSessionId: string;
  selectedCwd?: string;
  pickRemoteCwd: () => Promise<string | null>;
  setSessions: Dispatch<SetStateAction<ChatSession[]>>;
  setSessionDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setSessionNotices: Dispatch<SetStateAction<Record<string, SessionNotice | undefined>>>;
  clearSessionNotice: (sessionId: string) => void;
};

/**
 * @deprecated Use useFileAndCwdActionsFromStore() instead for Store-based usage.
 */
export function useFileAndCwdActions({
  t,
  selectedSessionId,
  selectedCwd,
  pickRemoteCwd,
  setSessions,
  setSessionDrafts,
  setSessionNotices,
  clearSessionNotice,
}: UseFileAndCwdActionsLegacyArgs) {
  const pickFiles = useCallback(async (): Promise<string[]> => {
    try {
      const selection = await open({
        directory: false,
        multiple: true,
      });
      if (typeof selection === 'string') return [selection];
      if (Array.isArray(selection)) {
        return selection.filter((item): item is string => typeof item === 'string');
      }
      return [];
    } catch (err) {
      devDebug('[codex] Failed to open file picker', err);
      return [];
    }
  }, []);

  const handleCwdSelect = useCallback(
    (cwd: string) => {
      const sessionId = selectedSessionId;
      if (!sessionId) return;
      setSessions((prev) =>
        prev.map((session) => (session.id === sessionId ? { ...session, cwd } : session))
      );
      clearSessionNotice(sessionId);
    },
    [clearSessionNotice, selectedSessionId, setSessions]
  );

  const handleSelectCwd = useCallback(async () => {
    const sessionId = selectedSessionId;
    if (!sessionId) return;
    try {
      const remoteSelection = await pickRemoteCwd();
      if (remoteSelection) {
        handleCwdSelect(remoteSelection);
        return;
      }
      const selection = await open({
        directory: true,
        multiple: false,
        defaultPath:
          selectedCwd && selectedCwd.trim() !== '' && !isRemotePath(selectedCwd)
            ? selectedCwd
            : undefined,
      });
      const nextCwd =
        typeof selection === 'string'
          ? selection
          : Array.isArray(selection) && typeof selection[0] === 'string'
            ? selection[0]
            : null;
      if (!nextCwd) return;
      handleCwdSelect(nextCwd);
    } catch (err) {
      devDebug('[codex] Failed to select working directory', err);
      setSessionNotices((prev) => ({
        ...prev,
        [sessionId]: {
          kind: 'error',
          message: t('errors.genericError', { error: formatError(err) }),
        },
      }));
    }
  }, [handleCwdSelect, pickRemoteCwd, selectedCwd, selectedSessionId, setSessionNotices, t]);

  const handleAddFile = useCallback(async () => {
    const sessionId = selectedSessionId;
    if (!sessionId) return;
    const files = await pickFiles();
    if (files.length === 0) return;

    setSessionDrafts((prev) => {
      const current = prev[sessionId] ?? '';
      const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
      const nextValue = `${current}${separator}${files
        .map((file) => t('chat.filePrefix', { path: file }))
        .join('\n')}`;
      return { ...prev, [sessionId]: nextValue };
    });
  }, [pickFiles, selectedSessionId, setSessionDrafts, t]);

  const handleFileSelect = useCallback(
    (path: string) => {
      const sessionId = selectedSessionId;
      if (!sessionId) return;

      setSessionDrafts((prev) => {
        const current = prev[sessionId] ?? '';
        const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
        const nextValue = `${current}${separator}${t('chat.filePrefix', { path })}`;
        return { ...prev, [sessionId]: nextValue };
      });
    },
    [selectedSessionId, setSessionDrafts, t]
  );

  return {
    handleCwdSelect,
    handleSelectCwd,
    handleAddFile,
    handleFileSelect,
  };
}

/**
 * File and CWD actions using SessionStore directly.
 * This is the preferred hook for new code.
 */
export function useFileAndCwdActionsFromStore() {
  const { t } = useTranslation();
  const pickRemoteCwd = useRemoteCwdPicker();

  const selectedSessionId = useSessionStore((s) => s.selectedSessionId);
  const updateSession = useSessionStore((s) => s.updateSession);
  const setDraft = useSessionStore((s) => s.setDraft);
  const setNotice = useSessionStore((s) => s.setNotice);
  const clearSessionNotice = useSessionStore((s) => s.clearSessionNotice);

  // Get selectedCwd from current session
  const selectedCwd = useSessionStore((s) => {
    const session = s.sessions.find((sess) => sess.id === s.selectedSessionId);
    return session?.cwd;
  });

  const pickFiles = useCallback(async (): Promise<string[]> => {
    try {
      const selection = await open({
        directory: false,
        multiple: true,
      });
      if (typeof selection === 'string') return [selection];
      if (Array.isArray(selection)) {
        return selection.filter((item): item is string => typeof item === 'string');
      }
      return [];
    } catch (err) {
      devDebug('[codex] Failed to open file picker', err);
      return [];
    }
  }, []);

  const handleCwdSelect = useCallback(
    (cwd: string) => {
      if (!selectedSessionId) return;
      updateSession(selectedSessionId, { cwd });
      clearSessionNotice(selectedSessionId);
    },
    [clearSessionNotice, selectedSessionId, updateSession]
  );

  const handleSelectCwd = useCallback(async () => {
    if (!selectedSessionId) return;
    try {
      const remoteSelection = await pickRemoteCwd();
      if (remoteSelection) {
        handleCwdSelect(remoteSelection);
        return;
      }
      const selection = await open({
        directory: true,
        multiple: false,
        defaultPath:
          selectedCwd && selectedCwd.trim() !== '' && !isRemotePath(selectedCwd)
            ? selectedCwd
            : undefined,
      });
      const nextCwd =
        typeof selection === 'string'
          ? selection
          : Array.isArray(selection) && typeof selection[0] === 'string'
            ? selection[0]
            : null;
      if (!nextCwd) return;
      handleCwdSelect(nextCwd);
    } catch (err) {
      devDebug('[codex] Failed to select working directory', err);
      setNotice(selectedSessionId, {
        kind: 'error',
        message: t('errors.genericError', { error: formatError(err) }),
      });
    }
  }, [handleCwdSelect, pickRemoteCwd, selectedCwd, selectedSessionId, setNotice, t]);

  const handleAddFile = useCallback(async () => {
    if (!selectedSessionId) return;
    const files = await pickFiles();
    if (files.length === 0) return;

    const currentDraft = useSessionStore.getState().sessionDrafts[selectedSessionId] ?? '';
    const separator = currentDraft.length > 0 && !currentDraft.endsWith('\n') ? '\n' : '';
    const nextValue = `${currentDraft}${separator}${files
      .map((file) => t('chat.filePrefix', { path: file }))
      .join('\n')}`;
    setDraft(selectedSessionId, nextValue);
  }, [pickFiles, selectedSessionId, setDraft, t]);

  const handleFileSelect = useCallback(
    (path: string) => {
      if (!selectedSessionId) return;

      const currentDraft = useSessionStore.getState().sessionDrafts[selectedSessionId] ?? '';
      const separator = currentDraft.length > 0 && !currentDraft.endsWith('\n') ? '\n' : '';
      const nextValue = `${currentDraft}${separator}${t('chat.filePrefix', { path })}`;
      setDraft(selectedSessionId, nextValue);
    },
    [selectedSessionId, setDraft, t]
  );

  return {
    handleCwdSelect,
    handleSelectCwd,
    handleAddFile,
    handleFileSelect,
  };
}
