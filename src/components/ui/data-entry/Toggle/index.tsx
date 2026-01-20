import { forwardRef } from 'react';

import { cn } from '../../../../utils/cn';

import type { ToggleProps } from './types';

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  {
    checked,
    onChange,
    disabled = false,
    className = 'settings-toggle',
    activeClassName = 'settings-toggle--active',
    knobClassName = 'settings-toggle__knob',
    ...buttonProps
  },
  ref
) {
  const classes = cn(className, checked && activeClassName);

  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      {...buttonProps}
    >
      <span className={knobClassName} />
    </button>
  );
});

Toggle.displayName = 'Toggle';

export type { ToggleProps } from './types';
