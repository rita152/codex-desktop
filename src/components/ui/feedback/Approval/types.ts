/** 审批状态（与 codex-acp ReviewDecision 对应） */
export type ApprovalStatus = 'pending' | 'approved' | 'approved-for-session' | 'rejected';

/** 审批类型 */
export type ApprovalType = 'exec' | 'patch';

/** 权限选项类型（与 codex-acp PermissionOptionKind 对应） */
export type PermissionOptionKind = 'allow-once' | 'allow-always' | 'reject-once' | 'reject-always';

/** 权限选项 */
export interface PermissionOption {
  /** 选项 ID */
  id: string;
  /** 显示文本 */
  label: string;
  /** 选项类型 */
  kind: PermissionOptionKind;
}

export interface ApprovalDiff {
  /** 文件路径 */
  path: string;
  /** unified diff 字符串 */
  diff: string;
}

export interface ApprovalProps {
  /** 工具调用 ID */
  callId: string;
  /** 审批类型 */
  type: ApprovalType;
  /** 审批标题 */
  title: string;
  /** 展示样式 */
  variant?: 'card' | 'embedded';
  /** 当前状态 */
  status: ApprovalStatus;
  /** 权限选项（默认根据 type 自动生成） */
  options?: PermissionOption[];
  /** 是否禁用操作 */
  disabled?: boolean;
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 审批说明文本 */
  description?: string;
  /** 命令内容 */
  command?: string;
  /** Diff 预览 */
  diffs?: ApprovalDiff[];
  /** 选择回调 */
  onSelect?: (callId: string, optionId: string) => void;
  /** 自定义类名 */
  className?: string;
}
