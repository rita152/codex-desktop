/** 工具调用状态（与 ACP ToolCallStatus 一致） */
export type ToolCallStatus = 'pending' | 'in-progress' | 'completed' | 'failed';

/** 工具类型（与 ACP ToolKind 一致） */
export type ToolKind =
  | 'read'
  | 'edit'
  | 'execute'
  | 'search'
  | 'fetch'
  | 'browser'
  | 'mcp'
  | 'other';

/** 文件位置范围 */
export interface LocationRange {
  startLine: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
}

/** 工具调用涉及的文件位置 */
export interface ToolCallLocation {
  /** 文件 URI */
  uri: string;
  /** 可选的行/列范围 */
  range?: LocationRange;
}

/** 文件差异内容 */
export interface DiffContent {
  type: 'diff';
  /** 文件路径 */
  path: string;
  /** 差异内容 */
  diff: string;
}

/** 终端内容 */
export interface TerminalContent {
  type: 'terminal';
  /** 终端 ID */
  terminalId: string;
}

/** 文本内容 */
export interface TextContent {
  type: 'text';
  text: string;
}

/** 工具调用内容（与 ACP ToolCallContent 一致） */
export type ToolCallContent = TextContent | DiffContent | TerminalContent;

export interface ToolCallProps {
  /** 工具调用唯一标识符 */
  toolCallId: string;
  /** 工具调用标题（显示名称） */
  title: string;
  /** 工具类型 */
  kind?: ToolKind;
  /** 工具调用状态 */
  status: ToolCallStatus;
  /** 工具产生的内容 */
  content?: ToolCallContent[];
  /** 正在访问/修改的文件位置 */
  locations?: ToolCallLocation[];
  /** 原始输入参数 */
  rawInput?: unknown;
  /** 原始输出结果 */
  rawOutput?: unknown;
  /** 错误信息（当 status 为 failed 时） */
  error?: string;
  /** 开始时间戳（用于显示执行时长） */
  startTime?: number;
  /** 执行时长（秒），仅在 completed/failed 时使用 */
  duration?: number;
  /** 默认是否展开 */
  defaultOpen?: boolean;
  /** 自定义类名 */
  className?: string;
}
