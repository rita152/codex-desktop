import { useTranslation } from 'react-i18next';
import { ClockIcon, CloseIcon } from '../../ui/data-display/Icon';
import { IconButton } from '../../ui/data-entry/IconButton';
import { cn } from '../../../utils/cn';
import type { QueuedMessage } from '../../../hooks/useMessageQueue';

import './QueueIndicator.css';

export interface QueueIndicatorProps {
    /** 队列中的消息列表 */
    queue: QueuedMessage[];
    /** 移除队列中的消息 */
    onRemove?: (messageId: string) => void;
    /** 清空整个队列 */
    onClearAll?: () => void;
    /** 自定义类名 */
    className?: string;
}

/**
 * 队列指示器组件
 * 显示排队等待的消息列表
 */
export function QueueIndicator({
    queue,
    onRemove,
    onClearAll,
    className = '',
}: QueueIndicatorProps) {
    const { t } = useTranslation();

    if (queue.length === 0) {
        return null;
    }

    return (
        <div className={cn('queue-indicator', className)}>
            <div className="queue-indicator__header">
                <div className="queue-indicator__title">
                    <ClockIcon size={14} />
                    <span>
                        {t('queue.title', { count: queue.length })}
                    </span>
                </div>
                {onClearAll && queue.length > 1 && (
                    <button
                        className="queue-indicator__clear-all"
                        onClick={onClearAll}
                        type="button"
                    >
                        {t('queue.clearAll')}
                    </button>
                )}
            </div>
            <div className="queue-indicator__list">
                {queue.map((message, index) => (
                    <div key={message.id} className="queue-indicator__item">
                        <span className="queue-indicator__index">{index + 1}</span>
                        <span className="queue-indicator__content">
                            {message.content.length > 50
                                ? `${message.content.slice(0, 50)}...`
                                : message.content}
                        </span>
                        {onRemove && (
                            <IconButton
                                icon={<CloseIcon size={12} />}
                                onClick={() => onRemove(message.id)}
                                aria-label={t('queue.remove')}
                                size="sm"
                                variant="ghost"
                                className="queue-indicator__remove"
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}


