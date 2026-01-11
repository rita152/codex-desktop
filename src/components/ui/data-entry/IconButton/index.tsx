import { forwardRef } from 'react';

import { cn } from '../../../../utils/cn';

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
  const classes = cn(
    'icon-button',
    `icon-button--${size}`,
    `icon-button--${variant}`,
    className
  );

  return (
    <button ref={ref} type="button" className={classes} {...buttonProps} aria-label={ariaLabel}>
      {icon}
    </button>
  );
});

IconButton.displayName = 'IconButton';

export type { IconButtonProps } from './types';
