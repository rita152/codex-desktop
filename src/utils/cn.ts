/**
 * Conditional class name utility.
 * Supports strings, booleans, objects, and nested arrays.
 *
 * @example
 * cn('base', condition && 'active') // 'base active' or 'base'
 * cn('base', { active: true, disabled: false }) // 'base active'
 * cn(['a', 'b'], 'c') // 'a b c'
 */

export type ClassValue =
  | string
  | false
  | null
  | undefined
  | Record<string, boolean | undefined | null>
  | ClassValue[];

export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];

  for (const value of values) {
    if (!value) continue;

    if (typeof value === 'string') {
      classes.push(value);
    } else if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) classes.push(nested);
    } else if (typeof value === 'object') {
      for (const [key, condition] of Object.entries(value)) {
        if (condition) classes.push(key);
      }
    }
  }

  return classes.join(' ');
}
