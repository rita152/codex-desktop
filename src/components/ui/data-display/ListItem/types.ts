import type { HTMLAttributes, ReactNode } from 'react';

export interface ListItemAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

export interface ListItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'onClick'
> {
  icon?: ReactNode;
  children: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  actions?: ListItemAction[];
  editing?: boolean;
  editValue?: string;
  onEditChange?: (value: string) => void;
  onEditConfirm?: () => void;
  onEditCancel?: () => void;
  className?: string;
}
