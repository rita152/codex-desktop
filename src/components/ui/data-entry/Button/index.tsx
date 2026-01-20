import { forwardRef } from 'react';

import { cn } from '../../../../utils/cn';

import type { ButtonProps } from './types';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = '', type = 'button', ...buttonProps },
  ref
) {
  return <button ref={ref} type={type} className={cn(className)} {...buttonProps} />;
});

Button.displayName = 'Button';

export type { ButtonProps } from './types';
