import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type {
  ApprovalDecision,
  ApprovalRequest,
  CodexErrorEvent,
  MessageChunk,
  NewSessionResult,
  PromptResult,
  ToolCall,
  ToolCallUpdate,
  TurnCompleteEvent,
  InitializeResult,
  CodexAuthMethod,
  CodexDebugEvent,
} from '../types/codex';

export async function initCodex(): Promise<InitializeResult> {
  return invoke<InitializeResult>('codex_init');
}

export async function authenticate(method: CodexAuthMethod, apiKey?: string): Promise<void> {
  await invoke<void>('codex_auth', {
    method,
    apiKey,
    api_key: apiKey,
  });
}

export async function createSession(cwd: string): Promise<NewSessionResult> {
  return invoke<NewSessionResult>('codex_new_session', { cwd });
}

export async function sendPrompt(sessionId: string, content: string): Promise<PromptResult> {
  return invoke<PromptResult>('codex_prompt', {
    sessionId,
    session_id: sessionId,
    content,
  });
}

export async function cancelPrompt(sessionId: string): Promise<void> {
  await invoke<void>('codex_cancel', {
    sessionId,
    session_id: sessionId,
  });
}

export async function approveRequest(
  sessionId: string,
  requestId: string,
  decision?: ApprovalDecision,
  optionId?: string
): Promise<void> {
  await invoke<void>('codex_approve', {
    sessionId,
    session_id: sessionId,
    requestId,
    request_id: requestId,
    decision: decision ?? null,
    optionId,
    option_id: optionId,
  });
}

export async function setSessionMode(sessionId: string, modeId: string): Promise<void> {
  await invoke<void>('codex_set_mode', {
    sessionId,
    session_id: sessionId,
    modeId,
    mode_id: modeId,
  });
}

export async function setSessionModel(sessionId: string, modelId: string): Promise<void> {
  await invoke<void>('codex_set_model', {
    sessionId,
    session_id: sessionId,
    modelId,
    model_id: modelId,
  });
}

export async function setSessionConfigOption(
  sessionId: string,
  configId: string,
  valueId: string
): Promise<void> {
  await invoke<void>('codex_set_config_option', {
    sessionId,
    session_id: sessionId,
    configId,
    config_id: configId,
    valueId,
    value_id: valueId,
  });
}

export interface CodexEventHandlers {
  onMessageChunk?: (payload: MessageChunk) => void;
  onThoughtChunk?: (payload: MessageChunk) => void;
  onToolCall?: (payload: { sessionId: string; toolCall: ToolCall }) => void;
  onToolCallUpdate?: (payload: { sessionId: string; update: ToolCallUpdate }) => void;
  onApprovalRequest?: (payload: ApprovalRequest) => void;
  onPlan?: (payload: { sessionId: string; plan: unknown }) => void;
  onAvailableCommands?: (payload: { sessionId: string; update: unknown }) => void;
  onCurrentMode?: (payload: { sessionId: string; update: unknown }) => void;
  onConfigOptionUpdate?: (payload: { sessionId: string; update: unknown }) => void;
  onTurnComplete?: (payload: TurnCompleteEvent) => void;
  onError?: (payload: CodexErrorEvent) => void;
  onDebug?: (payload: CodexDebugEvent) => void;
}

export async function subscribeToEvents(handlers: CodexEventHandlers): Promise<UnlistenFn> {
  const unlisteners = await Promise.all([
    listen<MessageChunk>('codex:message', (event) => handlers.onMessageChunk?.(event.payload)),
    listen<MessageChunk>('codex:thought', (event) => handlers.onThoughtChunk?.(event.payload)),
    listen<{ sessionId: string; toolCall: ToolCall }>('codex:tool-call', (event) =>
      handlers.onToolCall?.(event.payload)
    ),
    listen<{ sessionId: string; update: ToolCallUpdate }>('codex:tool-call-update', (event) =>
      handlers.onToolCallUpdate?.(event.payload)
    ),
    listen<ApprovalRequest>('codex:approval-request', (event) =>
      handlers.onApprovalRequest?.(event.payload)
    ),
    listen<{ sessionId: string; plan: unknown }>('codex:plan', (event) => handlers.onPlan?.(event.payload)),
    listen<{ sessionId: string; update: unknown }>('codex:available-commands', (event) =>
      handlers.onAvailableCommands?.(event.payload)
    ),
    listen<{ sessionId: string; update: unknown }>('codex:current-mode', (event) =>
      handlers.onCurrentMode?.(event.payload)
    ),
    listen<{ sessionId: string; update: unknown }>('codex:config-option-update', (event) =>
      handlers.onConfigOptionUpdate?.(event.payload)
    ),
    listen<TurnCompleteEvent>('codex:turn-complete', (event) =>
      handlers.onTurnComplete?.(event.payload)
    ),
    listen<CodexErrorEvent>('codex:error', (event) => handlers.onError?.(event.payload)),
    listen<CodexDebugEvent>('codex:debug', (event) => handlers.onDebug?.(event.payload)),
  ]);

  return () => {
    for (const unlisten of unlisteners) unlisten();
  };
}
