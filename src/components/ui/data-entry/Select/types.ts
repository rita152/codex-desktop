import type { ReactNode } from 'react';

export interface SelectOption {
  /** 选项值 */
  value: string;
  /** 显示文本 */
  label: string;
  /** 选项图标 */
  icon?: ReactNode;
}

type SelectA11yProps =
  | { 'aria-label': string; 'aria-labelledby'?: string }
  | { 'aria-label'?: string; 'aria-labelledby': string };

export interface SelectBaseProps {
  /** 触发器 id */
  id?: string;
  /** 选项列表 */
  options: SelectOption[];
  /** 当前选中值 */
  value?: string;
  /** 选中回调 */
  onChange?: (value: string) => void;
  /** 占位文字 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 边框是否透明 */
  borderless?: boolean;
  /** 宽度 */
  width?: string | number;
  /** 前置图标 */
  icon?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 下拉面板标题 */
  dropdownTitle?: string;
  /** 下拉面板样式变体 */
  variant?: 'default' | 'glass';
}

export type SelectProps = SelectBaseProps & SelectA11yProps;
