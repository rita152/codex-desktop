import { forwardRef } from 'react';

import { cn } from '../../../../utils/cn';

import type { InputProps } from './types';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', ...inputProps },
  ref
) {
  return <input ref={ref} className={cn(className)} {...inputProps} />;
});

Input.displayName = 'Input';

export type { InputProps } from './types';
