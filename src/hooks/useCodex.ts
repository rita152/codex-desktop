import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  approveRequest,
  authenticate,
  cancelPrompt,
  createSession,
  initCodex,
  sendPrompt,
  setSessionConfigOption,
  setSessionMode,
  setSessionModel,
  subscribeToEvents,
} from '../api/codex';

import type {
  ApprovalDecision,
  ApprovalRequest,
  CodexAuthMethod,
  InitializeResult,
  NewSessionResult,
} from '../types/codex';

export type CodexConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticated';

function extractSlashCommands(update: unknown): string[] {
  if (!update || typeof update !== 'object') return [];

  const maybeCommands = (update as { commands?: unknown }).commands;
  if (!Array.isArray(maybeCommands)) return [];

  const names: string[] = [];
  for (const cmd of maybeCommands) {
    if (typeof cmd === 'string') {
      names.push(cmd);
      continue;
    }
    if (!cmd || typeof cmd !== 'object') continue;
    const maybeName = (cmd as { name?: unknown; command?: unknown }).name ?? (cmd as { command?: unknown }).command;
    if (typeof maybeName === 'string') names.push(maybeName);
  }
  return Array.from(new Set(names)).sort();
}

export interface UseCodexResult {
  status: CodexConnectionStatus;
  initResult: InitializeResult | null;

  sessionId: string | null;
  setSessionId: (next: string | null) => void;

  streamingText: string;
  isStreaming: boolean;

  pendingApprovals: ApprovalRequest[];
  availableSlashCommands: string[];

  sessionState: NewSessionResult | null;
  modes: unknown;
  models: unknown;
  configOptions: unknown;
  currentModeUpdate: unknown;
  configOptionUpdates: unknown[];

  connect: () => Promise<InitializeResult>;
  authenticate: (method: CodexAuthMethod, apiKey?: string) => Promise<void>;
  newSession: (cwd: string) => Promise<NewSessionResult>;
  sendMessage: (content: string, overrideSessionId?: string) => Promise<void>;
  cancel: (overrideSessionId?: string) => Promise<void>;
  approve: (request: ApprovalRequest, decision?: ApprovalDecision, optionId?: string) => Promise<void>;

  setMode: (modeId: string, overrideSessionId?: string) => Promise<void>;
  setModel: (modelId: string, overrideSessionId?: string) => Promise<void>;
  setConfigOption: (configId: string, valueId: string, overrideSessionId?: string) => Promise<void>;
}

export function useCodex(initialSessionId?: string): UseCodexResult {
  const [status, setStatus] = useState<CodexConnectionStatus>('disconnected');
  const [initResult, setInitResult] = useState<InitializeResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [sessionState, setSessionState] = useState<NewSessionResult | null>(null);
  const [modes, setModes] = useState<unknown>(null);
  const [models, setModels] = useState<unknown>(null);
  const [configOptions, setConfigOptions] = useState<unknown>(null);
  const [currentModeUpdate, setCurrentModeUpdate] = useState<unknown>(null);
  const [configOptionUpdates, setConfigOptionUpdates] = useState<unknown[]>([]);

  const [streamingTextBySession, setStreamingTextBySession] = useState<Record<string, string>>({});
  const [isStreamingBySession, setIsStreamingBySession] = useState<Record<string, boolean>>({});

  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [availableSlashCommands, setAvailableSlashCommands] = useState<string[]>([]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;

    void subscribeToEvents({
      onMessageChunk: ({ sessionId: sid, text }) => {
        setStreamingTextBySession((prev) => ({ ...prev, [sid]: (prev[sid] ?? '') + text }));
        setIsStreamingBySession((prev) => ({ ...prev, [sid]: true }));
      },
      onTurnComplete: ({ sessionId: sid }) => {
        setIsStreamingBySession((prev) => ({ ...prev, [sid]: false }));
      },
      onError: () => {
        setIsStreamingBySession((prev) => {
          if (!sessionId) return prev;
          return { ...prev, [sessionId]: false };
        });
      },
      onApprovalRequest: (req) => {
        setPendingApprovals((prev) => {
          const key = `${req.sessionId}:${req.requestId}`;
          const next = prev.filter((p) => `${p.sessionId}:${p.requestId}` !== key);
          return [...next, req];
        });
      },
      onAvailableCommands: ({ update }) => {
        setAvailableSlashCommands(extractSlashCommands(update));
      },
      onCurrentMode: ({ sessionId: sid, update }) => {
        if (sid !== sessionId) return;
        setCurrentModeUpdate(update);
      },
      onConfigOptionUpdate: ({ sessionId: sid, update }) => {
        if (sid !== sessionId) return;
        setConfigOptionUpdates((prev) => [...prev, update]);
      },
      onPlan: () => {},
      onThoughtChunk: () => {},
      onToolCall: () => {},
      onToolCallUpdate: () => {},
    }).then((fn) => {
      if (disposed) {
        fn();
        return;
      }
      unlisten = fn;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [sessionId]);

  const connect = useCallback(async () => {
    setStatus((s) => (s === 'disconnected' ? 'connecting' : s));
    const result = await initCodex();
    if (!mountedRef.current) return result;

    setInitResult(result);
    setStatus('connected');
    return result;
  }, []);

  const auth = useCallback(async (method: CodexAuthMethod, apiKey?: string) => {
    await authenticate(method, apiKey);
    if (!mountedRef.current) return;
    setStatus('authenticated');
  }, []);

  const newSession = useCallback(async (cwd: string) => {
    const res = await createSession(cwd);
    if (!mountedRef.current) return res;

    setSessionId(res.sessionId);
    setSessionState(res);
    setModes(res.modes ?? null);
    setModels(res.models ?? null);
    setConfigOptions(res.configOptions ?? null);
    setCurrentModeUpdate(null);
    setConfigOptionUpdates([]);
    setStreamingTextBySession((prev) => ({ ...prev, [res.sessionId]: '' }));
    setIsStreamingBySession((prev) => ({ ...prev, [res.sessionId]: false }));
    return res;
  }, []);

  const sendMessage = useCallback(
    async (content: string, overrideSessionId?: string) => {
      const sid = overrideSessionId ?? sessionId;
      if (!sid) throw new Error('No active sessionId; call newSession() first.');
      await sendPrompt(sid, content);
    },
    [sessionId]
  );

  const cancel = useCallback(
    async (overrideSessionId?: string) => {
      const sid = overrideSessionId ?? sessionId;
      if (!sid) return;
      await cancelPrompt(sid);
    },
    [sessionId]
  );

  const approve = useCallback(
    async (req: ApprovalRequest, decision?: ApprovalDecision, optionId?: string) => {
      await approveRequest(req.sessionId, req.requestId, decision, optionId);
      if (!mountedRef.current) return;
      setPendingApprovals((prev) =>
        prev.filter((p) => !(p.sessionId === req.sessionId && p.requestId === req.requestId))
      );
    },
    []
  );

  const setMode = useCallback(
    async (modeId: string, overrideSessionId?: string) => {
      const sid = overrideSessionId ?? sessionId;
      if (!sid) throw new Error('No active sessionId; call newSession() first.');
      await setSessionMode(sid, modeId);
    },
    [sessionId]
  );

  const setModel = useCallback(
    async (modelId: string, overrideSessionId?: string) => {
      const sid = overrideSessionId ?? sessionId;
      if (!sid) throw new Error('No active sessionId; call newSession() first.');
      await setSessionModel(sid, modelId);
    },
    [sessionId]
  );

  const setConfigOption = useCallback(
    async (configId: string, valueId: string, overrideSessionId?: string) => {
      const sid = overrideSessionId ?? sessionId;
      if (!sid) throw new Error('No active sessionId; call newSession() first.');
      await setSessionConfigOption(sid, configId, valueId);
    },
    [sessionId]
  );

  const streamingText = useMemo(() => {
    if (!sessionId) return '';
    return streamingTextBySession[sessionId] ?? '';
  }, [sessionId, streamingTextBySession]);

  const isStreaming = useMemo(() => {
    if (!sessionId) return false;
    return isStreamingBySession[sessionId] ?? false;
  }, [sessionId, isStreamingBySession]);

  return {
    status,
    initResult,
    sessionId,
    setSessionId,
    streamingText,
    isStreaming,
    pendingApprovals,
    availableSlashCommands,
    sessionState,
    modes,
    models,
    configOptions,
    currentModeUpdate,
    configOptionUpdates,
    connect,
    authenticate: auth,
    newSession,
    sendMessage,
    cancel,
    approve,
    setMode,
    setModel,
    setConfigOption,
  };
}
