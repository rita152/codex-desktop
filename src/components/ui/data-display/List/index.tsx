import type { ListProps } from './types';

import './List.css';

export function List({
  children,
  scrollable = false,
  className = '',
  ...listProps
}: ListProps) {
  const classes = [
    'list',
    scrollable && 'list--scrollable',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ul {...listProps} className={classes} role={listProps.role ?? 'list'}>
      {children}
    </ul>
  );
}

export type { ListProps } from './types';
