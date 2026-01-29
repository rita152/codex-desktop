/**
 * Session Context - Manages session-related state
 *
 * This context handles:
 * - Session list and selection
 * - Session messages and drafts
 * - Session metadata (notices, options, etc.)
 * - Generation and terminal state
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
  type MutableRefObject,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useSessionPersistence } from '../hooks/useSessionPersistence';
import { useSessionMeta } from '../hooks/useSessionMeta';
import { useSelectOptionsCache } from '../hooks/useSelectOptionsCache';
import { useSessionViewState } from '../hooks/useSessionViewState';
import { useFileAndCwdActions } from '../hooks/useFileAndCwdActions';
import { useRemoteCwdPicker } from '../hooks/useRemoteCwdPicker';
import {
  loadModeOptionsCache,
  loadModelOptionsCache,
  saveModeOptionsCache,
  saveModelOptionsCache,
} from '../api/storage';
import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID, DEFAULT_SLASH_COMMANDS } from '../constants/chat';
import { resolveOptionId } from '../utils/optionSelection';

import type { ChatSession } from '../types/session';
import type { Message } from '../types/message';
import type { PlanStep } from '../types/message';
import type { SelectOption } from '../types/options';
import type { SessionNotice, SlashCommand } from '../types/chat';

// Types
interface SessionContextValue {
  // Session list
  sessions: ChatSession[];
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  selectedSessionId: string;
  setSelectedSessionId: (id: string) => void;

  // Messages and drafts
  sessionMessages: Record<string, Message[]>;
  setSessionMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>;
  sessionDrafts: Record<string, string>;
  setSessionDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  // Session metadata
  sessionNotices: Record<string, SessionNotice | undefined>;
  setSessionNotices: React.Dispatch<
    React.SetStateAction<Record<string, SessionNotice | undefined>>
  >;
  clearSessionNotice: (sessionId: string) => void;
  removeSessionMeta: (sessionId: string, newSessionId?: string) => void;

  // Options
  sessionSlashCommands: Record<string, SlashCommand[]>;
  setSessionSlashCommands: React.Dispatch<React.SetStateAction<Record<string, SlashCommand[]>>>;
  sessionModelOptions: Record<string, SelectOption[]>;
  setSessionModelOptions: React.Dispatch<React.SetStateAction<Record<string, SelectOption[]>>>;
  sessionModeOptions: Record<string, SelectOption[]>;
  setSessionModeOptions: React.Dispatch<React.SetStateAction<Record<string, SelectOption[]>>>;
  modelCache: { options: SelectOption[]; currentId: string };
  applyModelOptions: (params: {
    options: SelectOption[];
    currentId?: string;
    fallbackCurrentId?: string;
  }) => void;
  applyModeOptions: (params: {
    options: SelectOption[];
    currentId?: string;
    fallbackCurrentId?: string;
  }) => void;

  // Generation state
  isGeneratingBySession: Record<string, boolean>;
  setIsGeneratingBySession: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  // Terminal state
  terminalBySession: Record<string, string>;
  setTerminalBySession: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  // Active session ref
  activeSessionIdRef: MutableRefObject<string>;

  // Derived state (from useSessionViewState)
  activeSession: ChatSession | undefined;
  messages: Message[];
  draftMessage: string;
  selectedModel: string;
  selectedMode: string;
  selectedCwd: string;
  sessionNotice: SessionNotice | undefined;
  agentOptions: SelectOption[];
  modelOptions: SelectOption[];
  slashCommands: SlashCommand[];
  isGenerating: boolean;
  cwdLocked: boolean;
  activeTerminalId: string | undefined;
  currentPlan: PlanStep[] | undefined;

  // Session Actions
  handleDraftChange: (value: string) => void;
  handleNewChat: () => void;
  handleSessionSelect: (sessionId: string) => void;
  handleSessionRename: (sessionId: string, newTitle: string) => void;

  // File and CWD Actions
  handleCwdSelect: (cwd: string | null) => void;
  handleSelectCwd: () => Promise<void>;
  handleAddFile: () => Promise<void>;
  handleFileSelect: (filePath: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// Provider Component
interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const { t } = useTranslation();

  // Core session state from useSessionPersistence
  const {
    sessions,
    setSessions,
    selectedSessionId,
    setSelectedSessionId,
    sessionMessages,
    setSessionMessages,
    sessionDrafts,
    setSessionDrafts,
  } = useSessionPersistence();

  // Session metadata from useSessionMeta
  const {
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
  } = useSessionMeta();

  // Model options cache
  const { cache: modelCache, applyOptions: applyModelOptions } = useSelectOptionsCache({
    sessions,
    defaultId: DEFAULT_MODEL_ID,
    loadCache: () => {
      const cached = loadModelOptionsCache();
      return cached ? { options: cached.options, currentId: cached.currentModelId } : null;
    },
    saveCache: ({ options, currentId }) =>
      saveModelOptionsCache({ options, currentModelId: currentId }),
    setSessionOptions: setSessionModelOptions,
  });

  // Mode options cache
  const { applyOptions: applyModeOptions } = useSelectOptionsCache({
    sessions,
    defaultId: DEFAULT_MODE_ID,
    loadCache: () => {
      const cached = loadModeOptionsCache();
      return cached ? { options: cached.options, currentId: cached.currentModeId } : null;
    },
    saveCache: ({ options, currentId }) =>
      saveModeOptionsCache({ options, currentModeId: currentId }),
    setSessionOptions: setSessionModeOptions,
  });

  // Local state
  const [terminalBySession, setTerminalBySession] = useState<Record<string, string>>({});
  const [isGeneratingBySession, setIsGeneratingBySession] = useState<Record<string, boolean>>({});

  // Active session ref
  const activeSessionIdRef = useRef<string>(selectedSessionId);

  // Keep ref in sync
  useEffect(() => {
    activeSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  // Derived state from useSessionViewState
  const {
    activeSession,
    messages,
    draftMessage,
    selectedModel,
    selectedMode,
    selectedCwd,
    sessionNotice,
    agentOptions,
    modelOptions,
    slashCommands,
    isGenerating,
    cwdLocked,
    activeTerminalId,
  } = useSessionViewState({
    sessions,
    selectedSessionId,
    sessionMessages,
    sessionDrafts,
    sessionNotices,
    sessionModeOptions,
    sessionModelOptions,
    sessionSlashCommands,
    modelCache,
    isGeneratingBySession,
    terminalBySession,
    defaultModelId: DEFAULT_MODEL_ID,
    defaultModeId: DEFAULT_MODE_ID,
    defaultSlashCommands: DEFAULT_SLASH_COMMANDS,
  });

  // Session Actions
  const handleDraftChange = useCallback(
    (value: string) => {
      setSessionDrafts((prev) => ({ ...prev, [selectedSessionId]: value }));
    },
    [selectedSessionId, setSessionDrafts]
  );

  const handleNewChat = useCallback(() => {
    // Create new session in current working directory
    const newId = String(Date.now());
    const newSession: ChatSession = {
      id: newId,
      title: t('chat.newSessionTitle'),
      cwd: selectedCwd, // Inherit current session's cwd
      model: DEFAULT_MODEL_ID,
      mode: DEFAULT_MODE_ID,
    };
    setSessions((prev) => [newSession, ...prev]);
    setSessionMessages((prev) => ({ ...prev, [newId]: [] }));
    setSessionDrafts((prev) => ({ ...prev, [newId]: '' }));
    setIsGeneratingBySession((prev) => ({ ...prev, [newId]: false }));
    setSelectedSessionId(newId);
    clearSessionNotice(newId);
    activeSessionIdRef.current = newId;
  }, [
    clearSessionNotice,
    selectedCwd,
    setSelectedSessionId,
    setSessionDrafts,
    setSessionMessages,
    setSessions,
    t,
  ]);

  const handleSessionSelect = useCallback(
    (sessionId: string) => {
      setSelectedSessionId(sessionId);
      activeSessionIdRef.current = sessionId;
    },
    [setSelectedSessionId]
  );

  const handleSessionRename = useCallback(
    (sessionId: string, newTitle: string) => {
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s)));
    },
    [setSessions]
  );

  // File and CWD actions
  const pickRemoteCwd = useRemoteCwdPicker();
  const { handleCwdSelect, handleSelectCwd, handleAddFile, handleFileSelect } =
    useFileAndCwdActions({
      t,
      selectedSessionId,
      selectedCwd,
      pickRemoteCwd,
      setSessions,
      setSessionDrafts,
      setSessionNotices,
      clearSessionNotice,
    });

  // Derived: current active plan from messages
  const currentPlan = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const planSteps = messages[i].planSteps;
      if (planSteps && planSteps.length > 0) {
        // Hide plan when all steps are completed
        const allCompleted = planSteps.every((step) => step.status === 'completed');
        if (allCompleted) {
          return undefined;
        }
        return planSteps;
      }
    }
    return undefined;
  }, [messages]);

  // Auto-select available model when current is unavailable
  useEffect(() => {
    if (!modelOptions || modelOptions.length === 0) return;
    const available = new Set(modelOptions.map((option) => option.value));
    if (available.has(selectedModel)) return;

    const preferred = resolveOptionId({
      availableOptions: modelOptions,
      fallbackIds: [DEFAULT_MODEL_ID, modelCache.currentId],
      defaultId: DEFAULT_MODEL_ID,
    });

    if (!preferred || preferred === selectedModel) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === selectedSessionId ? { ...session, model: preferred } : session
      )
    );
  }, [modelCache.currentId, modelOptions, selectedModel, selectedSessionId, setSessions]);

  // Auto-select available mode when current is unavailable
  useEffect(() => {
    if (!agentOptions || agentOptions.length === 0) return;
    const available = new Set(agentOptions.map((option) => option.value));
    if (available.has(selectedMode)) return;

    const preferred = resolveOptionId({
      availableOptions: agentOptions,
      fallbackIds: [DEFAULT_MODE_ID],
      defaultId: DEFAULT_MODE_ID,
    });

    if (!preferred || preferred === selectedMode) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === selectedSessionId ? { ...session, mode: preferred } : session
      )
    );
  }, [agentOptions, selectedMode, selectedSessionId, setSessions]);

  const value = useMemo<SessionContextValue>(
    () => ({
      // Session list
      sessions,
      setSessions,
      selectedSessionId,
      setSelectedSessionId,

      // Messages and drafts
      sessionMessages,
      setSessionMessages,
      sessionDrafts,
      setSessionDrafts,

      // Session metadata
      sessionNotices,
      setSessionNotices,
      clearSessionNotice,
      removeSessionMeta,

      // Options
      sessionSlashCommands,
      setSessionSlashCommands,
      sessionModelOptions,
      setSessionModelOptions,
      sessionModeOptions,
      setSessionModeOptions,
      modelCache,
      applyModelOptions,
      applyModeOptions,

      // Generation state
      isGeneratingBySession,
      setIsGeneratingBySession,

      // Terminal state
      terminalBySession,
      setTerminalBySession,

      // Active session ref
      activeSessionIdRef,

      // Derived state
      activeSession,
      messages,
      draftMessage,
      selectedModel,
      selectedMode,
      selectedCwd,
      sessionNotice,
      agentOptions,
      modelOptions,
      slashCommands,
      isGenerating,
      cwdLocked,
      activeTerminalId,
      currentPlan,

      // Session Actions
      handleDraftChange,
      handleNewChat,
      handleSessionSelect,
      handleSessionRename,

      // File and CWD Actions
      handleCwdSelect,
      handleSelectCwd,
      handleAddFile,
      handleFileSelect,
    }),
    [
      sessions,
      setSessions,
      selectedSessionId,
      setSelectedSessionId,
      sessionMessages,
      setSessionMessages,
      sessionDrafts,
      setSessionDrafts,
      sessionNotices,
      setSessionNotices,
      clearSessionNotice,
      removeSessionMeta,
      sessionSlashCommands,
      setSessionSlashCommands,
      sessionModelOptions,
      setSessionModelOptions,
      sessionModeOptions,
      setSessionModeOptions,
      modelCache,
      applyModelOptions,
      applyModeOptions,
      isGeneratingBySession,
      terminalBySession,
      activeSession,
      messages,
      draftMessage,
      selectedModel,
      selectedMode,
      selectedCwd,
      sessionNotice,
      agentOptions,
      modelOptions,
      slashCommands,
      isGenerating,
      cwdLocked,
      activeTerminalId,
      currentPlan,
      handleDraftChange,
      handleNewChat,
      handleSessionSelect,
      handleSessionRename,
      handleCwdSelect,
      handleSelectCwd,
      handleAddFile,
      handleFileSelect,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// Hook to use Session Context
export function useSessionContext(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
}

// Export types
export type { SessionContextValue };
