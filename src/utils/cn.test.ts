import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins string values', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('handles conditional strings', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('handles object syntax', () => {
    expect(
      cn('base', {
        active: true,
        disabled: false,
        hidden: undefined,
        visible: null,
      })
    ).toBe('base active');
  });

  it('handles nested arrays', () => {
    expect(cn(['a', 'b'], 'c', ['d', ['e', 'f']])).toBe('a b c d e f');
  });

  it('handles mixed syntax', () => {
    const isActive = true;
    expect(
      cn('base', isActive && 'active', { highlighted: true, muted: false }, ['extra', 'classes'])
    ).toBe('base active highlighted extra classes');
  });

  it('returns empty string for all falsy values', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles empty arrays', () => {
    expect(cn('a', [], 'b')).toBe('a b');
  });

  it('handles empty objects', () => {
    expect(cn('a', {}, 'b')).toBe('a b');
  });
});
