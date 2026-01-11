export interface MarkdownProps {
  /** Markdown 内容 */
  content: string;
  /** 合并连续换行（3个及以上换行合并为2个） */
  compact?: boolean;
  /** 自定义类名 */
  className?: string;
}
