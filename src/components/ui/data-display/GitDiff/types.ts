import type { CSSProperties } from 'react';

/** Diff 行类型 */
export type DiffLineType = 'add' | 'remove' | 'context' | 'header' | 'hunk';

/** 单行 Diff 数据 */
export interface DiffLine {
  /** 行类型 */
  type: DiffLineType;
  /** 行内容 */
  content: string;
  /** 旧文件行号 */
  oldLineNumber?: number;
  /** 新文件行号 */
  newLineNumber?: number;
}

/** 文件 Diff 数据 */
export interface FileDiff {
  /** 旧文件路径 */
  oldPath: string;
  /** 新文件路径 */
  newPath: string;
  /** Diff 行列表 */
  lines: DiffLine[];
}

/** GitDiff 组件 Props */
export interface GitDiffProps {
  /** unified diff 格式的字符串 */
  diff: string;
  /** 是否显示行号 */
  showLineNumbers?: boolean;
  /** 文件名（可选，覆盖从 diff 解析的文件名） */
  fileName?: string;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}
