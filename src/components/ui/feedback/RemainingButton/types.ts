export interface RemainingButtonProps {
  /** 剩余百分比 */
  percent?: number;
  /** 总 token 数 */
  totalTokens?: number;
  /** 剩余 token 数 */
  remainingTokens?: number;
  /** 点击回调 */
  onClick?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}
