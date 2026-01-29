import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CornerDownRightIcon,
  ArrowUpIcon,
  TrashIcon,
  PencilIcon,
} from '../../ui/data-display/Icon';
import { IconButton } from '../../ui/data-entry/IconButton';
import { cn } from '../../../utils/cn';
import type { QueuedMessage } from '../../../hooks/useMessageQueue';

import './QueueIndicator.css';

export interface QueueIndicatorProps {
  /** 队列中的消息列表 */
  queue: QueuedMessage[];
  /** 移除队列中的消息 */
  onRemove?: (messageId: string) => void;
  /** 将消息移到队首 */
  onMoveToTop?: (messageId: string) => void;
  /** 编辑消息 */
  onEdit?: (messageId: string) => void;
  /** 清空整个队列 */
  onClearAll?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 队列指示器组件
 * 显示排队等待的消息列表
 */
export const QueueIndicator = memo(function QueueIndicator({
  queue,
  onRemove,
  onMoveToTop,
  onEdit,
  className = '',
}: QueueIndicatorProps) {
  const { t } = useTranslation();

  if (queue.length === 0) {
    return null;
  }

  return (
    <div className={cn('queue-indicator', className)}>
      <div className="queue-indicator__list">
        {queue.map((message) => (
          <div key={message.id} className="queue-indicator__item">
            <CornerDownRightIcon size={14} className="queue-indicator__prefix" />
            <span className="queue-indicator__content">
              {message.content.length > 100
                ? `${message.content.slice(0, 100)}...`
                : message.content}
            </span>
            <div className="queue-indicator__actions">
              {onMoveToTop && (
                <IconButton
                  icon={<ArrowUpIcon size={14} />}
                  onClick={() => onMoveToTop(message.id)}
                  aria-label={t('queue.moveToTop', { defaultValue: 'Move to Top' })}
                  size="sm"
                  variant="ghost"
                  className="queue-indicator__action"
                />
              )}
              {onRemove && (
                <IconButton
                  icon={<TrashIcon size={14} />}
                  onClick={() => onRemove(message.id)}
                  aria-label={t('queue.remove')}
                  size="sm"
                  variant="ghost"
                  className="queue-indicator__action"
                />
              )}
              <IconButton
                icon={<PencilIcon size={14} />}
                onClick={() => onEdit?.(message.id)}
                aria-label={t('common.edit', { defaultValue: 'Edit' })}
                size="sm"
                variant="ghost"
                className="queue-indicator__action"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

QueueIndicator.displayName = 'QueueIndicator';
