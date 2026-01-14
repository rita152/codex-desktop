import { useEffect, useRef, useState } from 'react';
import type { WheelEvent } from 'react';

import { cn } from '../../../../utils/cn';
import { Thinking } from '../Thinking';
import { ToolCall } from '../ToolCall';
import { Approval } from '../Approval';

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

const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return remainingSeconds > 0
    ? `${minutes} 分 ${remainingSeconds} 秒`
    : `${minutes} 分钟`;
};

export function Working({
  items,
  isOpen,
  isActive = false,
  onToggle,
  className = '',
}: WorkingProps) {
  const [internalOpen, setInternalOpen] = useState(isOpen ?? false);
  const [now, setNow] = useState(() => Date.now());
  const contentRef = useRef<HTMLDivElement>(null);
  const open = isOpen ?? internalOpen;
  const canToggle = items.length > 0;

  useEffect(() => {
    if (isOpen === undefined) return;
    setInternalOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [isActive]);

  const handleToggle = () => {
    if (!canToggle) return;
    if (isOpen === undefined) {
      setInternalOpen((prev) => !prev);
    }
    onToggle?.();
  };

  const itemCount = items.length;
  const itemLabel = `${itemCount} item${itemCount === 1 ? '' : 's'}`;
  const totalSeconds = items.reduce((total, item) => {
    if (item.type === 'thinking') {
      const { duration, startTime, isStreaming, phase } = item.data;
      if (duration !== undefined) return total + duration;
      const thinkingActive =
        isStreaming === true || phase === 'thinking' || phase === 'working';
      if (thinkingActive && startTime !== undefined) {
        return total + (now - startTime) / 1000;
      }
      return total;
    }
    if (item.type === 'toolcall') {
      const { duration, startTime, status } = item.data;
      if (duration !== undefined) return total + duration;
      if (
        (status === 'pending' || status === 'in-progress') &&
        startTime !== undefined
      ) {
        return total + (now - startTime) / 1000;
      }
      return total;
    }
    return total;
  }, 0);

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
        <span className="working__label">Working</span>
        <span className="working__meta">
          <span className="working__count">{itemLabel}</span>
          <span className="working__duration">总耗时 {formatDuration(totalSeconds)}</span>
          <span className="working__chevron">
            <ChevronDownIcon size={14} />
          </span>
        </span>
        <span className="working__spacer" />
        {isActive && <span className="working__status">In progress</span>}
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
