import type { ButtonHTMLAttributes } from 'react';

export interface ToggleProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'onClick' | 'type'
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeClassName?: string;
  knobClassName?: string;
}
