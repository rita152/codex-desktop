export type CodexAuthMethod = 'chatgpt' | 'codex-api-key' | 'openai-api-key';

export type ApprovalDecision = 'allow-always' | 'allow-once' | 'reject-always' | 'reject-once';

export interface CodexSession {
  sessionId: string;
  cwd?: string;
}

export interface MessageChunk {
  sessionId: string;
  text: string;
}

export interface ToolCall {
  toolCallId?: string;
  tool_call_id?: string;
  name?: string;
  title?: string;
  kind?: string;
  status?: string;
  content?: unknown;
  locations?: unknown;
  rawInput?: unknown;
  raw_input?: unknown;
  rawOutput?: unknown;
  raw_output?: unknown;
  _meta?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  arguments?: unknown;
  [key: string]: unknown;
}

export interface ToolCallUpdate {
  toolCallId?: string;
  tool_call_id?: string;
  title?: string;
  status?: string;
  content?: unknown;
  locations?: unknown;
  rawInput?: unknown;
  raw_input?: unknown;
  rawOutput?: unknown;
  raw_output?: unknown;
  _meta?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PermissionOption {
  optionId?: string;
  option_id?: string;
  kind?: ApprovalDecision | 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always' | 'abort';
  label?: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ApprovalRequest {
  sessionId: string;
  requestId: string;
  toolCall: ToolCall;
  options: PermissionOption[];
}

export interface InitializeResult {
  agentInfo: unknown;
  authMethods: AuthMethod[];
  protocolVersion: unknown;
}

export interface AuthMethod {
  id?: string;
  label?: string;
  description?: string;
  [key: string]: unknown;
}

export interface NewSessionResult {
  sessionId: string;
  modes?: unknown;
  models?: unknown;
  configOptions?: unknown;
}

export interface PromptResult {
  stopReason: unknown;
}

export interface TurnCompleteEvent {
  sessionId: string;
  stopReason: unknown;
}

export interface CodexErrorEvent {
  error: string;
}

export interface CodexDebugEvent {
  label: string;
  sessionId?: string | null;
  tsMs: number;
  dtMs: number;
  sincePromptMs?: number | null;
  sinceLastEventMs?: number | null;
  extra?: unknown;
}

export type CodexEvent =
  | { event: 'codex:message'; payload: MessageChunk }
  | { event: 'codex:thought'; payload: MessageChunk }
  | { event: 'codex:tool-call'; payload: { sessionId: string; toolCall: ToolCall } }
  | { event: 'codex:tool-call-update'; payload: { sessionId: string; update: ToolCallUpdate } }
  | { event: 'codex:approval-request'; payload: ApprovalRequest }
  | { event: 'codex:plan'; payload: { sessionId: string; plan: unknown } }
  | { event: 'codex:available-commands'; payload: { sessionId: string; update: unknown } }
  | { event: 'codex:current-mode'; payload: { sessionId: string; update: unknown } }
  | { event: 'codex:config-option-update'; payload: { sessionId: string; update: unknown } }
  | { event: 'codex:turn-complete'; payload: TurnCompleteEvent }
  | { event: 'codex:error'; payload: CodexErrorEvent }
  | { event: 'codex:debug'; payload: CodexDebugEvent };
