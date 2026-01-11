import type {
  KeyboardEvent as ReactKeyboardEvent,
  TextareaHTMLAttributes,
} from 'react';

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'rows'> {
  value: string;
  onChange: (value: string) => void;
  maxRows?: number;
  minRows?: number;
  onKeyDown?: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
}
