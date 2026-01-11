import { cn } from '../../../../utils/cn';

import type { ListProps } from './types';

import './List.css';

export function List({
  children,
  scrollable = false,
  className = '',
  ...listProps
}: ListProps) {
  const classes = cn('list', scrollable && 'list--scrollable', className);

  return (
    <ul {...listProps} className={classes} role={listProps.role ?? 'list'}>
      {children}
    </ul>
  );
}

export type { ListProps } from './types';
