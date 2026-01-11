import type { ReactNode } from 'react';
import type { HTMLAttributes } from 'react';

export interface ListProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode;
  scrollable?: boolean;
  className?: string;
}
