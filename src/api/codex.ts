import { invoke } from '@tauri-apps/api/core';

import type {
  ApprovalDecision,
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
