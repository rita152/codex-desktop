import { forwardRef } from 'react';

import type { IconButtonProps } from './types';

import './IconButton.css';

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    size = 'md',
    variant = 'default',
    className = '',
    'aria-label': ariaLabel,
    ...buttonProps
  },
  ref
) {
  const classes = [
    'icon-button',
    `icon-button--${size}`,
    `icon-button--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} type="button" className={classes} {...buttonProps} aria-label={ariaLabel}>
      {icon}
    </button>
  );
});

export type { IconButtonProps } from './types';
