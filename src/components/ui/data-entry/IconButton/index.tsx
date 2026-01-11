import './IconButton.css';

import type { IconButtonProps } from './types';

export function IconButton({
  icon,
  onClick,
  disabled = false,
  size = 'md',
  variant = 'default',
  className = '',
  'aria-label': ariaLabel,
}: IconButtonProps) {
  const classes = [
    'icon-button',
    `icon-button--${size}`,
    `icon-button--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {icon}
    </button>
  );
}

export type { IconButtonProps } from './types';
