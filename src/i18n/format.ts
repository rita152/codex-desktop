import type { TFunction } from 'i18next';

export const formatDurationShort = (t: TFunction, seconds: number): string => {
  if (seconds < 1) {
    return t('duration.ms', { value: Math.round(seconds * 1000) });
  }
  if (seconds < 60) {
    return t('duration.s', { value: seconds.toFixed(1) });
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return remainingSeconds > 0
    ? t('duration.m_s', { minutes, seconds: remainingSeconds })
    : t('duration.m', { minutes });
};

export const formatDurationLong = (t: TFunction, seconds: number): string => {
  if (seconds < 60) {
    return t('duration.seconds', { count: Math.round(seconds) });
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return remainingSeconds > 0
    ? t('duration.minutes_seconds', { minutes, seconds: remainingSeconds })
    : t('duration.minutes', { count: minutes });
};
