import type { ReactNode, CSSProperties } from 'react';

export type BorderWidth = 'thin' | 'medium' | 'thick' | 'bold';
export type BackgroundColor = 'default' | 'secondary' | 'elevated' | 'muted' | 'subtle';

export interface CardProps {
  /** 卡片内容 */
  children?: ReactNode;
  /** 宽度 */
  width?: string | number;
  /** 高度 */
  height?: string | number;
  /** 圆角大小 */
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** 是否显示阴影 */
  shadow?: boolean;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 边框粗细 */
  borderWidth?: BorderWidth;
  /** 背景颜色 */
  background?: BackgroundColor;
  /** 内边距大小 */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 点击事件 */
  onClick?: () => void;
}
