import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ListItemProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick' | 'type'> {
  icon?: ReactNode;
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}
