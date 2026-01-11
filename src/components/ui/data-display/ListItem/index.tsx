import type { ListItemProps } from './types';

import './ListItem.css';

export function ListItem({
  icon,
  children,
  selected = false,
  disabled = false,
  onClick,
  className = '',
  ...buttonProps
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
    <li className="list-item__wrapper">
      <button
        {...buttonProps}
        type="button"
        className={classes}
        onClick={handleClick}
        disabled={disabled}
        aria-current={selected ? 'true' : undefined}
      >
        {icon && <span className="list-item__icon">{icon}</span>}
        <span className="list-item__content">{children}</span>
      </button>
    </li>
  );
}

export type { ListItemProps } from './types';
