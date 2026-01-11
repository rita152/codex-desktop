import { useRef, useEffect } from 'react';

import type { ListItemProps } from './types';

import './ListItem.css';

export function ListItem({
  icon,
  children,
  selected = false,
  disabled = false,
  onClick,
  actions,
  editing = false,
  editValue = '',
  onEditChange,
  onEditConfirm,
  onEditCancel,
  className = '',
  ...buttonProps
}: ListItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const classes = [
    'list-item',
    selected && 'list-item--selected',
    disabled && 'list-item--disabled',
    actions && actions.length > 0 && 'list-item--has-actions',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = () => {
    if (!disabled && onClick && !editing) {
      onClick();
    }
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onEditConfirm?.();
    } else if (e.key === 'Escape') {
      onEditCancel?.();
    }
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <li className="list-item__wrapper">
        <div className={`${classes} list-item--editing`}>
          {icon && <span className="list-item__icon">{icon}</span>}
          <input
            ref={inputRef}
            type="text"
            className="list-item__input"
            value={editValue}
            onChange={(e) => onEditChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onEditConfirm}
          />
        </div>
      </li>
    );
  }

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
        {actions && actions.length > 0 && (
          <span className="list-item__actions">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="list-item__action"
                onClick={(e) => handleActionClick(e, action.onClick)}
                aria-label={action.label}
              >
                {action.icon}
              </button>
            ))}
          </span>
        )}
      </button>
    </li>
  );
}

export type { ListItemProps, ListItemAction } from './types';
