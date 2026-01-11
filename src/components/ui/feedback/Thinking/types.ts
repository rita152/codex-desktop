export interface ThinkingProps {
  /** 思考内容 */
  content: string;
  /** 是否正在流式传输 */
  isStreaming?: boolean;
  /** 思考开始时间戳（用于实时计时），传入 Date.now() 的值 */
  startTime?: number;
  /** 最终思考时长（秒），仅在 isStreaming=false 时使用 */
  duration?: number;
  /** 默认是否展开 */
  defaultOpen?: boolean;
  /** 自定义类名 */
  className?: string;
}
