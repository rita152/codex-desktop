import type { HTMLAttributes, ReactNode } from 'react';

export interface ListProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode;
  scrollable?: boolean;
  className?: string;
}
