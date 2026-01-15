import { useTranslation } from 'react-i18next';

import { cn } from '../../../../utils/cn';

import type { RemainingButtonProps } from './types';

import './RemainingButton.css';

function RemainingIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-4.16-7.5" />
      <polyline points="22 4 22 10 16 10" />
    </svg>
  );
}

export function RemainingButton({
  percent = 0,
  totalTokens,
  remainingTokens,
  onClick,
  disabled = false,
  className = '',
}: RemainingButtonProps) {
  const { t } = useTranslation();
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const classNames = cn('remaining-button', className);
  const titleParts: string[] = [];
  if (typeof totalTokens === 'number') {
    titleParts.push(t('remaining.totalTokens', { count: Math.round(totalTokens) }));
  }
  if (typeof remainingTokens === 'number') {
    titleParts.push(t('remaining.remainingTokens', { count: Math.round(remainingTokens) }));
  }
  const title = titleParts.length > 0 ? titleParts.join(' · ') : undefined;

  return (
    <button
      type="button"
      className={classNames}
      onClick={onClick}
      disabled={disabled}
      aria-label={t('remaining.ariaLabel', { count: clamped })}
      title={title}
    >
      <span className="remaining-button__icon">
        <RemainingIcon size={12} />
      </span>
      <span className="remaining-button__value">{clamped}%</span>
    </button>
  );
}

export type { RemainingButtonProps } from './types';
