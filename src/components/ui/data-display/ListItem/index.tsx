import { useRef, useEffect } from 'react';

import { cn } from '../../../../utils/cn';

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
  ...containerProps
}: ListItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isClickable = Boolean(onClick) && !editing;
  const isFocusable = isClickable && !disabled;

  const classes = cn(
    'list-item',
    selected && 'list-item--selected',
    disabled && 'list-item--disabled',
    actions && actions.length > 0 && 'list-item--has-actions',
    className
  );

  const handleClick = () => {
    if (!disabled && onClick && !editing) {
      onClick();
    }
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick || disabled || editing) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
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
        <div className={cn(classes, 'list-item--editing')}>
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
      <div
        {...containerProps}
        className={classes}
        onClick={handleClick}
        onKeyDown={handleRowKeyDown}
        role={isClickable ? 'button' : undefined}
        tabIndex={isFocusable ? 0 : isClickable ? -1 : undefined}
        aria-current={selected ? 'true' : undefined}
        aria-disabled={disabled || undefined}
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
                disabled={disabled}
              >
                {action.icon}
              </button>
            ))}
          </span>
        )}
      </div>
    </li>
  );
}

export type { ListItemProps, ListItemAction } from './types';
