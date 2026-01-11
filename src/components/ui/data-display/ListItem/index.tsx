import type { ListItemProps } from './types';

import './ListItem.css';

export function ListItem({
  icon,
  children,
  selected = false,
  disabled = false,
  onClick,
  className = '',
}: ListItemProps) {
  const classes = [
    'list-item',
    selected && 'list-item--selected',
    disabled && 'list-item--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <button type="button" className={classes} onClick={handleClick} disabled={disabled}>
      {icon && <span className="list-item__icon">{icon}</span>}
      <span className="list-item__content">{children}</span>
    </button>
  );
}

export type { ListItemProps } from './types';
