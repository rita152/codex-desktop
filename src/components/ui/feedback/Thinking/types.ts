export type ThinkingPhase = 'working' | 'thinking' | 'done';

export interface ThinkingProps {
  /** 思考内容 */
  content: string;
  /** 是否正在流式传输 */
  isStreaming?: boolean;
  /** 当前阶段：working(等待响应) → thinking(思考中) → done(完成) */
  phase?: ThinkingPhase;
  /** 思考开始时间戳（用于实时计时），传入 Date.now() 的值 */
  startTime?: number;
  /** 最终思考时长（秒），仅在 isStreaming=false 时使用 */
  duration?: number;
  /** 默认是否展开 */
  defaultOpen?: boolean;
  /** 自定义类名 */
  className?: string;
}
