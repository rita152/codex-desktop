export type ApprovalDecision = 'allow-always' | 'allow-once' | 'reject-always' | 'reject-once';

export interface ToolCall extends Record<string, unknown> {
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
}

export interface PermissionOption extends Record<string, unknown> {
  optionId?: string;
  option_id?: string;
  kind?:
    | ApprovalDecision
    | 'allow_once'
    | 'allow_always'
    | 'reject_once'
    | 'reject_always'
    | 'abort';
  label?: string;
  name?: string;
  description?: string;
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

export interface AuthMethod extends Record<string, unknown> {
  id?: string;
  label?: string;
  description?: string;
}

export interface NewSessionResult {
  sessionId: string;
  /** Path to rollout file for session resume */
  rolloutPath?: string;
  modes?: unknown;
  models?: unknown;
  configOptions?: unknown;
}

export interface PromptResult {
  stopReason: unknown;
}

export interface CodexCliConfigInfo {
  codexHome: string;
  configPath: string;
  configFound: boolean;
  modelProvider?: string;
  baseUrl?: string;
  envKey?: string;
  authFileFound: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
}

export interface TokenUsageInfo {
  totalTokenUsage: TokenUsage;
  lastTokenUsage: TokenUsage;
  modelContextWindow: number | null;
}

export interface TokenUsageEvent {
  sessionId: string;
  info: TokenUsageInfo | null;
  rateLimits: unknown;
  /** Remaining context percentage (0-100), calculated by backend */
  percentRemaining: number | null;
}

/** A single history item from rollout files */
export interface HistoryItem {
  /** Thread ID (UUID from rollout) */
  id: string;
  /** Display title (derived from cwd or first message) */
  title: string;
  /** Working directory for the session */
  cwd?: string;
  /** Absolute path to the rollout file for resume */
  rolloutPath: string;
  /** RFC3339 timestamp when session was created */
  createdAt?: string;
  /** RFC3339 timestamp when session was last updated */
  updatedAt?: string;
  /** Preview text (first user message or summary) */
  preview?: string;
}

/** Result of listing history sessions */
export interface HistoryListResult {
  /** List of history items */
  items: HistoryItem[];
  /** Whether more items are available (pagination) */
  hasMore: boolean;
}
