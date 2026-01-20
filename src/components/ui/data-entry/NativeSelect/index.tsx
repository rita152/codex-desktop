import { forwardRef } from 'react';

import { cn } from '../../../../utils/cn';

import type { NativeSelectProps } from './types';

export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(function NativeSelect(
  { className = '', ...selectProps },
  ref
) {
  return <select ref={ref} className={cn(className)} {...selectProps} />;
});

NativeSelect.displayName = 'NativeSelect';

export type { NativeSelectProps } from './types';
