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

// === New Event Types ===

/** Thread name updated event payload */
export interface ThreadNameUpdatedEvent {
  sessionId: string;
  threadId: string;
  threadName: string | null;
}

/** Thread rolled back event payload */
export interface ThreadRolledBackEvent {
  sessionId: string;
  numTurns: number;
}

/** Request user input question */
export interface RequestUserInputQuestion {
  id: string;
  prompt: string;
  type?: 'text' | 'password' | 'confirm';
  default?: string;
}

/** Request user input event payload */
export interface RequestUserInputEvent {
  sessionId: string;
  callId: string;
  turnId: string;
  questions: RequestUserInputQuestion[];
}

/** Dynamic tool call request event payload */
export interface DynamicToolCallEvent {
  sessionId: string;
  callId: string;
  turnId: string;
  tool: string;
  arguments: Record<string, unknown>;
}

/** MCP elicitation request event payload */
export interface ElicitationRequestEvent {
  sessionId: string;
  serverName: string;
  requestId: string;
  message: string;
}

/** View image tool call event payload */
export interface ViewImageEvent {
  sessionId: string;
  callId: string;
  path: string;
}

/** Terminal interaction event payload */
export interface TerminalInteractionEvent {
  sessionId: string;
  callId: string;
  processId: string;
  stdin: string;
}

/** Undo started event payload */
export interface UndoStartedEvent {
  sessionId: string;
  message: string | null;
}

/** Undo completed event payload */
export interface UndoCompletedEvent {
  sessionId: string;
  success: boolean;
  message: string | null;
}

/** Deprecation notice event payload */
export interface DeprecationNoticeEvent {
  sessionId: string;
  summary: string;
  details: string | null;
}

/** Background event payload */
export interface BackgroundEventPayload {
  sessionId: string;
  message: string;
}

/** Context compacted event payload */
export interface ContextCompactedEvent {
  sessionId: string;
}

/** MCP startup update event payload */
export interface McpStartupUpdateEvent {
  sessionId: string;
  server: string;
  status: string;
}

/** MCP startup complete event payload */
export interface McpStartupCompleteEvent {
  sessionId: string;
  ready: string[];
  failed: string[];
  cancelled: string[];
}
