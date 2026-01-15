export type ApprovalDecision = 'allow-always' | 'allow-once' | 'reject-always' | 'reject-once';

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

export interface TokenUsageEvent {
  sessionId: string;
  totalTokens: number;
  lastTokens?: number;
  contextWindow?: number | null;
  percentRemaining?: number | null;
}
