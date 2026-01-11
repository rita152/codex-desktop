import { forwardRef, useRef, useEffect } from 'react';

import type { TextAreaProps } from './types';

import './TextArea.css';

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  {
    value,
    onChange,
    maxRows = 6,
    minRows = 1,
    onKeyDown,
    className = '',
    ...textareaProps
  },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
    const minHeight = lineHeight * minRows;
    const maxHeight = lineHeight * maxRows;
    const scrollHeight = textarea.scrollHeight;

    textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
  }, [value, minRows, maxRows]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <textarea
      ref={(node) => {
        textareaRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      className={`textarea ${className}`}
      value={value}
      onChange={handleChange}
      {...textareaProps}
      onKeyDown={onKeyDown}
      rows={minRows}
    />
  );
});

export type { TextAreaProps } from './types';
