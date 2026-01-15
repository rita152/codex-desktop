import { useEffect, useMemo, useRef, useState } from 'react';
import type { WheelEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../../utils/cn';
import { Thinking } from '../Thinking';
import { ToolCall } from '../ToolCall';
import { Approval } from '../Approval';
import { formatDurationLong } from '../../../../i18n/format';

import type { WorkingItem, WorkingProps } from './types';

import './Working.css';

function ActivityIcon({ size = 16 }: { size?: number }) {
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
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function ChevronDownIcon({ size = 16 }: { size?: number }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const getItemKey = (item: WorkingItem, index: number): string => {
  if (item.type === 'toolcall') return item.data.toolCallId;
  if (item.type === 'approval') return item.data.callId;
  const startTime = item.data.startTime;
  return `thinking-${startTime ?? index}`;
};

const renderItem = (item: WorkingItem, index: number) => {
  if (item.type === 'thinking') {
    return <Thinking key={getItemKey(item, index)} {...item.data} />;
  }
  if (item.type === 'toolcall') {
    return <ToolCall key={getItemKey(item, index)} {...item.data} />;
  }
  return <Approval key={getItemKey(item, index)} {...item.data} />;
};

const hasIncompleteWorkingItem = (item: WorkingItem): boolean => {
  if (item.type === 'thinking') {
    return item.data.startTime === undefined || item.data.duration === undefined;
  }
  if (item.type === 'toolcall') {
    return (
      item.data.startTime === undefined ||
      item.data.duration === undefined ||
      item.data.status === 'pending' ||
      item.data.status === 'in-progress'
    );
  }
  return item.data.status === 'pending' || Boolean(item.data.loading);
};

const extractStartTime = (item: WorkingItem): number | undefined => {
  if (item.type === 'thinking') return item.data.startTime;
  if (item.type === 'toolcall') return item.data.startTime;
  return undefined;
};

const extractEndTime = (item: WorkingItem): number | null => {
  if (item.type === 'thinking') {
    if (item.data.startTime === undefined || item.data.duration === undefined) {
      return null;
    }
    return item.data.startTime + item.data.duration * 1000;
  }
  if (item.type === 'toolcall') {
    if (item.data.startTime === undefined || item.data.duration === undefined) {
      return null;
    }
    return item.data.startTime + item.data.duration * 1000;
  }
  return null;
};

export function Working({
  items,
  startTime,
  isOpen,
  isActive = false,
  onToggle,
  className = '',
}: WorkingProps) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(isOpen ?? false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const finishedAtRef = useRef<number | null>(null);
  const open = isOpen ?? internalOpen;
  const canToggle = items.length > 0;

  useEffect(() => {
    if (isOpen === undefined) return;
    setInternalOpen(isOpen);
  }, [isOpen]);

  const hasIncompleteItem = useMemo(
    () => items.some(hasIncompleteWorkingItem),
    [items]
  );

  useEffect(() => {
    if (!hasIncompleteItem) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [hasIncompleteItem]);

  useEffect(() => {
    if (hasIncompleteItem) {
      finishedAtRef.current = null;
      return;
    }
    if (finishedAtRef.current === null) {
      finishedAtRef.current = Date.now();
    }
  }, [hasIncompleteItem]);

  const handleToggle = () => {
    if (!canToggle) return;
    if (isOpen === undefined) {
      setInternalOpen((prev) => !prev);
    }
    onToggle?.();
  };

  const itemCount = items.length;
  const itemLabel = t('working.itemCount', { count: itemCount });
  const effectiveStart = useMemo(() => {
    if (typeof startTime === 'number') return startTime;
    const timestamps = items
      .map(extractStartTime)
      .filter((value): value is number => typeof value === 'number');
    return timestamps.length > 0 ? Math.min(...timestamps) : null;
  }, [items, startTime]);

  const effectiveEnd = useMemo(() => {
    const endTimes = items
      .map(extractEndTime)
      .filter((value): value is number => value !== null);
    return endTimes.length > 0 ? Math.max(...endTimes) : null;
  }, [items]);

  const resolvedEnd = hasIncompleteItem ? now : effectiveEnd ?? finishedAtRef.current;
  const totalSeconds =
    effectiveStart !== null && resolvedEnd !== null
      ? Math.max(0, (resolvedEnd - effectiveStart) / 1000)
      : 0;

  const classNames = cn(
    'working',
    open && 'working--open',
    isActive && 'working--active',
    className
  );

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const container = contentRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight <= clientHeight) return;
    const delta = event.deltaY;
    const atTop = scrollTop <= 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

    if ((delta < 0 && !atTop) || (delta > 0 && !atBottom)) {
      event.stopPropagation();
    }
  };

  return (
    <div className={classNames}>
      <button
        type="button"
        className="working__trigger"
        onClick={handleToggle}
        aria-expanded={open}
        disabled={!canToggle}
      >
        <span className="working__icon">
          <ActivityIcon size={16} />
        </span>
        <span className="working__label">{t('working.title')}</span>
        <span className="working__meta">
          <span className="working__count">{itemLabel}</span>
          <span className="working__duration">
            {t('working.totalDuration', {
              duration: formatDurationLong(t, totalSeconds),
            })}
          </span>
          <span className="working__chevron">
            <ChevronDownIcon size={14} />
          </span>
        </span>
        <span className="working__spacer" />
        {isActive && <span className="working__status">{t('working.inProgress')}</span>}
      </button>
      {open && (
        <div className="working__content" ref={contentRef} onWheel={handleWheel}>
          <div className="working__content-inner">
            <div className="working__items">{items.map(renderItem)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { WorkingItem, WorkingProps } from './types';
