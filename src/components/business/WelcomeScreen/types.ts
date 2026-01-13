import type { ReactNode } from 'react';

export interface WelcomeScreenProps {
  /** 应用名称 */
  appName?: string;
  /** 输入框插槽 */
  children?: ReactNode;
}
