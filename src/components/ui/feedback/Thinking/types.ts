import type { ThinkingPhase } from '../../../../types/thinking';

export type { ThinkingPhase } from '../../../../types/thinking';

export interface ThinkingProps {
  /** 思考内容 */
  content: string;
  /** 展示在触发器上的标题（可选） */
  title?: string;
  /** 展示样式 */
  variant?: 'card' | 'embedded';
  /** 触发器标题样式 */
  headerVariant?: 'default' | 'title';
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
  /** working 阶段是否隐藏标题区域 */
  hideWorkingLabel?: boolean;
  /** 自定义类名 */
  className?: string;
}
