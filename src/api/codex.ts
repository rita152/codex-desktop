import { invoke } from '@tauri-apps/api/core';

import type {
  ApprovalDecision,
  CodexCliConfigInfo,
  NewSessionResult,
  PromptResult,
  InitializeResult,
} from '../types/codex';

export async function initCodex(): Promise<InitializeResult> {
  return invoke<InitializeResult>('codex_init');
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

export async function setSessionModel(sessionId: string, modelId: string): Promise<void> {
  await invoke<void>('codex_set_model', {
    sessionId,
    session_id: sessionId,
    modelId,
    model_id: modelId,
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

export async function authCodex(method: string, apiKey?: string): Promise<void> {
  await invoke<void>('codex_auth', {
    method,
    api_key: apiKey ?? null,
  });
}

export async function loadCodexCliConfig(): Promise<CodexCliConfigInfo> {
  return invoke<CodexCliConfigInfo>('codex_load_cli_config');
}

export async function setCodexEnv(key: string, value: string): Promise<void> {
  await invoke<void>('codex_set_env', { key, value });
}

/**
 * Warmup the Codex ACP connection.
 * This pre-spawns the codex-acp process and initializes the protocol,
 * reducing latency for the first actual session creation.
 */
export async function warmupCodex(): Promise<void> {
  await invoke<void>('codex_warmup');
}
