/**
 * Session Store - Manages session-related state with Zustand
 *
 * This store handles:
 * - Session list and selection
 * - Session messages and drafts
 * - Session metadata (notices, options, etc.)
 * - Generation and terminal state
 */

import { create } from 'zustand';
import { subscribeWithSelector, persist, devtools } from 'zustand/middleware';
import { useMemo } from 'react';

import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID, DEFAULT_SLASH_COMMANDS } from '../constants/chat';

import type { ChatSession } from '../types/session';
import type { Message } from '../types/message';
import type { PlanStep } from '../types/plan';
import type { SelectOption } from '../types/options';

const EMPTY_MESSAGES: Message[] = [];
const EMPTY_SLASH_COMMANDS: string[] = [];
const EMPTY_SELECT_OPTIONS: SelectOption[] = [];

// Session Notice type
export interface SessionNotice {
  kind: 'error' | 'info';
  message: string;
}

// Options Cache type
export interface OptionsCache {
  options: SelectOption[] | null;
  currentId?: string;
}

// State types
interface SessionState {
  // Session list
  sessions: ChatSession[];
  selectedSessionId: string;

  // Messages and drafts (per session)
  sessionMessages: Record<string, Message[]>;
  sessionDrafts: Record<string, string>;

  // Session metadata (per session)
  sessionNotices: Record<string, SessionNotice | undefined>;
  sessionSlashCommands: Record<string, string[]>;
  sessionModelOptions: Record<string, SelectOption[]>;
  sessionModeOptions: Record<string, SelectOption[]>;

  // Options cache (global)
  modelCache: OptionsCache;
  modeCache: OptionsCache;

  // Generation state (per session)
  isGeneratingBySession: Record<string, boolean>;

  // Terminal state (per session)
  terminalBySession: Record<string, string>;
}

interface SessionActions {
  // Session list actions
  setSessions: (sessions: ChatSession[] | ((prev: ChatSession[]) => ChatSession[])) => void;
  setSelectedSessionId: (id: string) => void;
  addSession: (session: ChatSession) => void;
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => void;
  removeSession: (sessionId: string) => void;

  // Messages actions
  setSessionMessages: (
    messages:
      | Record<string, Message[]>
      | ((prev: Record<string, Message[]>) => Record<string, Message[]>)
  ) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  clearMessages: (sessionId: string) => void;

  // Drafts actions
  setSessionDrafts: (
    drafts: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)
  ) => void;
  setDraft: (sessionId: string, draft: string) => void;

  // Notices actions
  setSessionNotices: (
    notices:
      | Record<string, SessionNotice | undefined>
      | ((
          prev: Record<string, SessionNotice | undefined>
        ) => Record<string, SessionNotice | undefined>)
  ) => void;
  setNotice: (sessionId: string, notice: SessionNotice | undefined) => void;
  clearSessionNotice: (sessionId: string) => void;

  // Slash commands actions
  setSessionSlashCommands: (
    commands:
      | Record<string, string[]>
      | ((prev: Record<string, string[]>) => Record<string, string[]>)
  ) => void;

  // Model options actions
  setSessionModelOptions: (
    options:
      | Record<string, SelectOption[]>
      | ((prev: Record<string, SelectOption[]>) => Record<string, SelectOption[]>)
  ) => void;
  applyModelOptions: (payload: {
    options: SelectOption[];
    currentId?: string;
    fallbackCurrentId?: string;
  }) => void;

  // Mode options actions
  setSessionModeOptions: (
    options:
      | Record<string, SelectOption[]>
      | ((prev: Record<string, SelectOption[]>) => Record<string, SelectOption[]>)
  ) => void;
  applyModeOptions: (payload: {
    options: SelectOption[];
    currentId?: string;
    fallbackCurrentId?: string;
  }) => void;

  // Generation state actions
  setIsGeneratingBySession: (
    generating:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  setIsGenerating: (sessionId: string, isGenerating: boolean) => void;

  // Terminal state actions
  setTerminalBySession: (
    terminals: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)
  ) => void;
  setTerminal: (sessionId: string, terminalId: string) => void;
  clearTerminal: (sessionId: string) => void;

  // Session meta cleanup
  removeSessionMeta: (sessionId: string, newSessionId?: string) => void;

  // New chat action
  createNewChat: (cwd?: string, title?: string) => string;
}

export type SessionStore = SessionState & SessionActions;

// Create initial session
const createInitialSession = (): ChatSession => ({
  id: String(Date.now()),
  title: 'New Chat',
  model: DEFAULT_MODEL_ID,
  mode: DEFAULT_MODE_ID,
});

// Initial state
const initialSession = createInitialSession();
const initialState: SessionState = {
  sessions: [initialSession],
  selectedSessionId: initialSession.id,
  sessionMessages: { [initialSession.id]: [] },
  sessionDrafts: { [initialSession.id]: '' },
  sessionNotices: {},
  sessionSlashCommands: {},
  sessionModelOptions: {},
  sessionModeOptions: {},
  modelCache: { options: null, currentId: DEFAULT_MODEL_ID },
  modeCache: { options: null, currentId: DEFAULT_MODE_ID },
  isGeneratingBySession: { [initialSession.id]: false },
  terminalBySession: {},
};

// Helper to handle functional updates
const applyUpdate = <T>(current: T, update: T | ((prev: T) => T)): T => {
  return typeof update === 'function' ? (update as (prev: T) => T)(current) : update;
};

// Create the store with persistence
export const useSessionStore = create<SessionStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          ...initialState,

          // Session list actions
          setSessions: (sessions) =>
            set((state) => ({ sessions: applyUpdate(state.sessions, sessions) })),

          setSelectedSessionId: (id) => set({ selectedSessionId: id }),

          addSession: (session) =>
            set((state) => ({
              sessions: [session, ...state.sessions],
              sessionMessages: { ...state.sessionMessages, [session.id]: [] },
              sessionDrafts: { ...state.sessionDrafts, [session.id]: '' },
              isGeneratingBySession: { ...state.isGeneratingBySession, [session.id]: false },
            })),

          updateSession: (sessionId, updates) =>
            set((state) => ({
              sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, ...updates } : s)),
            })),

          removeSession: (sessionId) =>
            set((state) => {
              const { [sessionId]: _messages, ...restMessages } = state.sessionMessages;
              const { [sessionId]: _drafts, ...restDrafts } = state.sessionDrafts;
              const { [sessionId]: _notices, ...restNotices } = state.sessionNotices;
              const { [sessionId]: _generating, ...restGenerating } = state.isGeneratingBySession;
              const { [sessionId]: _terminal, ...restTerminals } = state.terminalBySession;
              const { [sessionId]: _slash, ...restSlash } = state.sessionSlashCommands;
              const { [sessionId]: _model, ...restModel } = state.sessionModelOptions;
              const { [sessionId]: _mode, ...restMode } = state.sessionModeOptions;

              return {
                sessions: state.sessions.filter((s) => s.id !== sessionId),
                sessionMessages: restMessages,
                sessionDrafts: restDrafts,
                sessionNotices: restNotices,
                isGeneratingBySession: restGenerating,
                terminalBySession: restTerminals,
                sessionSlashCommands: restSlash,
                sessionModelOptions: restModel,
                sessionModeOptions: restMode,
              };
            }),

          // Messages actions
          setSessionMessages: (messages) =>
            set((state) => ({ sessionMessages: applyUpdate(state.sessionMessages, messages) })),

          addMessage: (sessionId, message) =>
            set((state) => ({
              sessionMessages: {
                ...state.sessionMessages,
                [sessionId]: [...(state.sessionMessages[sessionId] ?? []), message],
              },
            })),

          updateMessage: (sessionId, messageId, updates) =>
            set((state) => ({
              sessionMessages: {
                ...state.sessionMessages,
                [sessionId]: (state.sessionMessages[sessionId] ?? []).map((m) =>
                  String(m.id) === messageId ? { ...m, ...updates } : m
                ),
              },
            })),

          clearMessages: (sessionId) =>
            set((state) => ({
              sessionMessages: { ...state.sessionMessages, [sessionId]: [] },
            })),

          // Drafts actions
          setSessionDrafts: (drafts) =>
            set((state) => ({ sessionDrafts: applyUpdate(state.sessionDrafts, drafts) })),

          setDraft: (sessionId, draft) =>
            set((state) => ({
              sessionDrafts: { ...state.sessionDrafts, [sessionId]: draft },
            })),

          // Notices actions
          setSessionNotices: (notices) =>
            set((state) => ({ sessionNotices: applyUpdate(state.sessionNotices, notices) })),

          setNotice: (sessionId, notice) =>
            set((state) => ({
              sessionNotices: { ...state.sessionNotices, [sessionId]: notice },
            })),

          clearSessionNotice: (sessionId) =>
            set((state) => {
              const { [sessionId]: _, ...rest } = state.sessionNotices;
              return { sessionNotices: rest };
            }),

          // Slash commands actions
          setSessionSlashCommands: (commands) =>
            set((state) => ({
              sessionSlashCommands: applyUpdate(state.sessionSlashCommands, commands),
            })),

          // Model options actions
          setSessionModelOptions: (options) =>
            set((state) => ({
              sessionModelOptions: applyUpdate(state.sessionModelOptions, options),
            })),

          applyModelOptions: ({ options, currentId, fallbackCurrentId }) => {
            const nextCurrentId = currentId ?? fallbackCurrentId;
            set({
              modelCache: { options, currentId: nextCurrentId },
            });
          },

          // Mode options actions
          setSessionModeOptions: (options) =>
            set((state) => ({
              sessionModeOptions: applyUpdate(state.sessionModeOptions, options),
            })),

          applyModeOptions: ({ options, currentId, fallbackCurrentId }) => {
            const nextCurrentId = currentId ?? fallbackCurrentId;
            set({
              modeCache: { options, currentId: nextCurrentId },
            });
          },

          // Generation state actions
          setIsGeneratingBySession: (generating) =>
            set((state) => ({
              isGeneratingBySession: applyUpdate(state.isGeneratingBySession, generating),
            })),

          setIsGenerating: (sessionId, isGenerating) =>
            set((state) => ({
              isGeneratingBySession: { ...state.isGeneratingBySession, [sessionId]: isGenerating },
            })),

          // Terminal state actions
          setTerminalBySession: (terminals) =>
            set((state) => ({
              terminalBySession: applyUpdate(state.terminalBySession, terminals),
            })),

          setTerminal: (sessionId, terminalId) =>
            set((state) => ({
              terminalBySession: { ...state.terminalBySession, [sessionId]: terminalId },
            })),

          clearTerminal: (sessionId) =>
            set((state) => {
              const { [sessionId]: _, ...rest } = state.terminalBySession;
              return { terminalBySession: rest };
            }),

          // Session meta cleanup
          removeSessionMeta: (sessionId, newSessionId) => {
            const state = get();
            const { [sessionId]: _notices, ...restNotices } = state.sessionNotices;
            const { [sessionId]: _slash, ...restSlash } = state.sessionSlashCommands;
            const { [sessionId]: _model, ...restModel } = state.sessionModelOptions;
            const { [sessionId]: _mode, ...restMode } = state.sessionModeOptions;

            const updates: Partial<SessionState> = {
              sessionNotices: newSessionId
                ? { ...restNotices, [newSessionId]: undefined }
                : restNotices,
              sessionSlashCommands: restSlash,
              sessionModelOptions: restModel,
              sessionModeOptions: restMode,
            };

            set(updates);
          },

          // New chat action
          createNewChat: (cwd, title = 'New Chat') => {
            const newId = String(Date.now());
            const newSession: ChatSession = {
              id: newId,
              title,
              cwd,
              model: DEFAULT_MODEL_ID,
              mode: DEFAULT_MODE_ID,
            };

            set((state) => ({
              sessions: [newSession, ...state.sessions],
              sessionMessages: { ...state.sessionMessages, [newId]: [] },
              sessionDrafts: { ...state.sessionDrafts, [newId]: '' },
              isGeneratingBySession: { ...state.isGeneratingBySession, [newId]: false },
              selectedSessionId: newId,
            }));

            return newId;
          },
        }),
        {
          name: 'codex-sessions',
          partialize: (state) => ({
            sessions: state.sessions,
            selectedSessionId: state.selectedSessionId,
            sessionMessages: state.sessionMessages,
            sessionDrafts: state.sessionDrafts,
          }),
          // Custom storage to handle Date serialization/deserialization
          storage: {
            getItem: (name) => {
              const str = localStorage.getItem(name);
              if (!str) return null;
              const parsed = JSON.parse(str);
              // Rehydrate timestamp strings back to Date objects
              if (parsed?.state?.sessionMessages) {
                for (const sessionId of Object.keys(parsed.state.sessionMessages)) {
                  const messages = parsed.state.sessionMessages[sessionId];
                  if (Array.isArray(messages)) {
                    for (const msg of messages) {
                      if (msg.timestamp && typeof msg.timestamp === 'string') {
                        const date = new Date(msg.timestamp);
                        // Only convert if valid date
                        msg.timestamp = isNaN(date.getTime()) ? undefined : date;
                      }
                    }
                  }
                }
              }
              return parsed;
            },
            setItem: (name, value) => {
              localStorage.setItem(name, JSON.stringify(value));
            },
            removeItem: (name) => {
              localStorage.removeItem(name);
            },
          },
          // Create a new session on app startup (after rehydration)
          onRehydrateStorage: () => (state) => {
            if (state) {
              // Use setTimeout to ensure store is fully initialized
              setTimeout(() => {
                state.createNewChat(undefined, 'New Chat');
              }, 0);
            }
          },
        }
      )
    ),
    { name: 'SessionStore', enabled: import.meta.env.DEV }
  )
);

// ============================================================================
// Derived State Selectors
// ============================================================================

/**
 * Get active session
 */
export const useActiveSession = () =>
  useSessionStore((state) => state.sessions.find((s) => s.id === state.selectedSessionId));

/**
 * Get current session's messages
 */
export const useCurrentMessages = () =>
  useSessionStore((state) => state.sessionMessages[state.selectedSessionId] ?? EMPTY_MESSAGES);

/**
 * Get current session's draft
 */
export const useCurrentDraft = () =>
  useSessionStore((state) => state.sessionDrafts[state.selectedSessionId] ?? '');

/**
 * Get current session's generation state
 */
export const useIsGenerating = () =>
  useSessionStore((state) => state.isGeneratingBySession[state.selectedSessionId] ?? false);

/**
 * Get current session's model
 */
export const useSelectedModel = () =>
  useSessionStore((state) => {
    const session = state.sessions.find((s) => s.id === state.selectedSessionId);
    return session?.model ?? DEFAULT_MODEL_ID;
  });

/**
 * Get current session's mode
 */
export const useSelectedMode = () =>
  useSessionStore((state) => {
    const session = state.sessions.find((s) => s.id === state.selectedSessionId);
    return session?.mode ?? DEFAULT_MODE_ID;
  });

/**
 * Get current session's cwd
 */
export const useSelectedCwd = () =>
  useSessionStore((state) => {
    const session = state.sessions.find((s) => s.id === state.selectedSessionId);
    return session?.cwd;
  });

/**
 * Get current session's notice
 */
export const useSessionNotice = () =>
  useSessionStore((state) => state.sessionNotices[state.selectedSessionId]);

/**
 * Get model options for current session
 */
export const useModelOptions = () => {
  const fromSession = useSessionStore(
    (state) => state.sessionModelOptions[state.selectedSessionId]
  );
  const cached = useSessionStore((state) => state.modelCache.options);

  return useMemo(() => {
    if (fromSession?.length) return fromSession;
    return cached ?? EMPTY_SELECT_OPTIONS;
  }, [cached, fromSession]);
};

/**
 * Get agent (mode) options for current session
 */
export const useAgentOptions = () => {
  const fromSession = useSessionStore((state) => state.sessionModeOptions[state.selectedSessionId]);
  return useMemo(() => (fromSession?.length ? fromSession : undefined), [fromSession]);
};

/**
 * Get slash commands for current session
 */
export const useSlashCommands = () => {
  const fromSession = useSessionStore(
    (state) => state.sessionSlashCommands[state.selectedSessionId] ?? EMPTY_SLASH_COMMANDS
  );
  return useMemo(() => {
    const merged = new Set([...DEFAULT_SLASH_COMMANDS, ...fromSession]);
    return Array.from(merged).sort();
  }, [fromSession]);
};

/**
 * Check if cwd is locked (has messages)
 */
export const useCwdLocked = () =>
  useSessionStore((state) => {
    const messages = state.sessionMessages[state.selectedSessionId] ?? EMPTY_MESSAGES;
    return messages.length > 0;
  });

/**
 * Get current active terminal id
 */
export const useActiveTerminalId = () =>
  useSessionStore((state) => state.terminalBySession[state.selectedSessionId]);

/**
 * Get current plan from messages
 */
export const useCurrentPlan = (): PlanStep[] | undefined =>
  useSessionStore((state) => {
    const messages = state.sessionMessages[state.selectedSessionId] ?? EMPTY_MESSAGES;
    for (let i = messages.length - 1; i >= 0; i--) {
      const planSteps = messages[i].planSteps;
      if (planSteps && planSteps.length > 0) {
        const allCompleted = planSteps.every((step) => step.status === 'completed');
        if (allCompleted) return undefined;
        return planSteps;
      }
    }
    return undefined;
  });

// ============================================================================
// Compatibility Layer - Provides same interface as old SessionContext
// ============================================================================

/**
 * Get all session view state (for components that need multiple values)
 */
export const useSessionViewState = () => {
  const selectedSessionId = useSessionStore((state) => state.selectedSessionId);
  const sessions = useSessionStore((state) => state.sessions);
  const messages = useSessionStore(
    (state) => state.sessionMessages[state.selectedSessionId] ?? EMPTY_MESSAGES
  );
  const draftMessage = useSessionStore(
    (state) => state.sessionDrafts[state.selectedSessionId] ?? ''
  );
  const sessionNotice = useSessionStore(
    (state) => state.sessionNotices[state.selectedSessionId] ?? null
  );
  const fromModelOptions = useSessionStore(
    (state) => state.sessionModelOptions[state.selectedSessionId]
  );
  const fromModeOptions = useSessionStore(
    (state) => state.sessionModeOptions[state.selectedSessionId]
  );
  const cachedModelOptions = useSessionStore((state) => state.modelCache.options);
  const fromSlashCommands = useSessionStore(
    (state) => state.sessionSlashCommands[state.selectedSessionId] ?? EMPTY_SLASH_COMMANDS
  );
  const isGenerating = useSessionStore(
    (state) => state.isGeneratingBySession[state.selectedSessionId] ?? false
  );
  const activeTerminalId = useSessionStore(
    (state) => state.terminalBySession[state.selectedSessionId]
  );

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId),
    [selectedSessionId, sessions]
  );

  const slashCommands = useMemo(() => {
    const merged = new Set([...DEFAULT_SLASH_COMMANDS, ...fromSlashCommands]);
    return Array.from(merged).sort();
  }, [fromSlashCommands]);

  const modelOptions = useMemo(() => {
    if (fromModelOptions?.length) return fromModelOptions;
    return cachedModelOptions ?? EMPTY_SELECT_OPTIONS;
  }, [cachedModelOptions, fromModelOptions]);

  const agentOptions = useMemo(() => {
    return fromModeOptions?.length ? fromModeOptions : undefined;
  }, [fromModeOptions]);

  return useMemo(
    () => ({
      activeSession,
      messages,
      draftMessage,
      selectedModel: activeSession?.model ?? DEFAULT_MODEL_ID,
      selectedMode: activeSession?.mode ?? DEFAULT_MODE_ID,
      selectedCwd: activeSession?.cwd,
      sessionNotice,
      agentOptions,
      modelOptions,
      slashCommands,
      isGenerating,
      cwdLocked: messages.length > 0,
      activeTerminalId,
    }),
    [
      activeSession,
      activeTerminalId,
      agentOptions,
      draftMessage,
      isGenerating,
      messages,
      modelOptions,
      sessionNotice,
      slashCommands,
    ]
  );
};
