export interface SelectOption {
  /** 选项值 */
  value: string;
  /** 显示文本 */
  label: string;
}

export interface SelectProps {
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
  /** 自定义类名 */
  className?: string;
}
