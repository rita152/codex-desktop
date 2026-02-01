import { useEffect, useMemo, useRef, useState } from 'react';
import type { WheelEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../../utils/cn';
import { Thinking } from '../Thinking';
import { ToolCall } from '../ToolCall';
import { ToolCallGroup } from '../ToolCallGroup';
import { Approval } from '../Approval';
import { formatDurationLong } from '../../../../i18n/format';
import { useGlobalTimer } from '../../../../hooks/useGlobalTimer';

import type { WorkingItem, WorkingProps } from './types';
import type { ToolCallProps } from '../ToolCall';

import './Working.css';

// Minimum number of consecutive toolcalls to form a group
const MIN_GROUP_SIZE = 3;

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

// Grouped item type for rendering
type GroupedItem =
  | { type: 'single'; item: WorkingItem; index: number }
  | { type: 'toolcall-group'; toolCalls: ToolCallProps[]; startIndex: number };

/**
 * Group consecutive toolcalls into ToolCallGroup when there are MIN_GROUP_SIZE or more.
 * Other items remain as single items.
 */
function groupItems(items: WorkingItem[]): GroupedItem[] {
  const result: GroupedItem[] = [];
  let i = 0;

  while (i < items.length) {
    const item = items[i];

    if (item.type === 'toolcall') {
      // Count consecutive toolcalls
      let j = i;
      const toolCalls: ToolCallProps[] = [];
      while (j < items.length && items[j].type === 'toolcall') {
        toolCalls.push((items[j] as { type: 'toolcall'; data: ToolCallProps }).data);
        j++;
      }

      if (toolCalls.length >= MIN_GROUP_SIZE) {
        // Group them
        result.push({ type: 'toolcall-group', toolCalls, startIndex: i });
        i = j;
      } else {
        // Not enough to group, add as single items
        for (let k = i; k < j; k++) {
          result.push({ type: 'single', item: items[k], index: k });
        }
        i = j;
      }
    } else {
      // Non-toolcall item
      result.push({ type: 'single', item, index: i });
      i++;
    }
  }

  return result;
}

const renderSingleItem = (item: WorkingItem, index: number) => {
  if (item.type === 'thinking') {
    return (
      <Thinking key={getItemKey(item, index)} {...item.data} variant="embedded" hideWorkingLabel />
    );
  }
  if (item.type === 'toolcall') {
    return <ToolCall key={getItemKey(item, index)} {...item.data} variant="embedded" />;
  }
  return <Approval key={getItemKey(item, index)} {...item.data} variant="embedded" />;
};

const renderGroupedItem = (groupedItem: GroupedItem) => {
  if (groupedItem.type === 'single') {
    return renderSingleItem(groupedItem.item, groupedItem.index);
  }
  // toolcall-group
  const groupId = `toolcall-group-${groupedItem.startIndex}`;
  return (
    <ToolCallGroup
      key={groupId}
      groupId={groupId}
      toolCalls={groupedItem.toolCalls}
      variant="embedded"
    />
  );
};

const hasIncompleteWorkingItem = (item: WorkingItem): boolean => {
  if (item.type === 'thinking') {
    return (
      item.data.isStreaming === true ||
      item.data.phase === 'thinking' ||
      item.data.phase === 'working'
    );
  }
  if (item.type === 'toolcall') {
    return item.data.status === 'pending' || item.data.status === 'in-progress';
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
  const finishedAtRef = useRef<number | null>(null);
  const open = isOpen ?? internalOpen;
  const canToggle = items.length > 0;

  useEffect(() => {
    if (isOpen === undefined) return;
    setInternalOpen(isOpen);
  }, [isOpen]);

  const hasIncompleteItem = useMemo(() => items.some(hasIncompleteWorkingItem), [items]);
  const shouldTimerRun = isActive || hasIncompleteItem;

  // Use global timer instead of individual setInterval per component
  const now = useGlobalTimer(shouldTimerRun);

  useEffect(() => {
    if (shouldTimerRun) {
      finishedAtRef.current = null;
      return;
    }
    if (finishedAtRef.current === null) {
      finishedAtRef.current = Date.now();
    }
  }, [shouldTimerRun]);

  const handleToggle = () => {
    if (!canToggle) return;
    if (isOpen === undefined) {
      setInternalOpen((prev) => !prev);
    }
    onToggle?.();
  };

  const itemCount = items.length;
  const itemLabel = t('working.itemCount', { count: itemCount });
  const { effectiveStart, effectiveEnd } = useMemo(() => {
    const hasExplicitStart = typeof startTime === 'number';
    let minStart: number | null = hasExplicitStart ? startTime : null;
    let maxEnd: number | null = null;

    for (const item of items) {
      if (!hasExplicitStart) {
        const itemStart = extractStartTime(item);
        if (typeof itemStart === 'number') {
          minStart = minStart === null ? itemStart : Math.min(minStart, itemStart);
        }
      }
      const itemEnd = extractEndTime(item);
      if (typeof itemEnd === 'number') {
        maxEnd = maxEnd === null ? itemEnd : Math.max(maxEnd, itemEnd);
      }
    }

    return { effectiveStart: minStart, effectiveEnd: maxEnd };
  }, [items, startTime]);

  const resolvedEnd = shouldTimerRun ? now : (effectiveEnd ?? finishedAtRef.current);
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
        <span className="working__label">
          {isActive ? t('working.title') : t('working.finished')}
        </span>
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
            <div className="working__items">{groupItems(items).map(renderGroupedItem)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { WorkingItem, WorkingProps } from './types';
