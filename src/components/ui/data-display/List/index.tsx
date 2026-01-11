import './List.css';

import type { ListProps } from './types';

export function List({
  children,
  scrollable = false,
  className = '',
}: ListProps) {
  const classes = [
    'list',
    scrollable && 'list--scrollable',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
}

export type { ListProps } from './types';
