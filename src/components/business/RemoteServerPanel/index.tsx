import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { RemoteServerManager } from '../RemoteServerManager';
import { ServerIcon } from '../../ui/data-display/Icon';
import { Button } from '../../ui/data-entry/Button';
import { cn } from '../../../utils/cn';

import './RemoteServerPanel.css';

type RemoteServerPanelProps = {
    visible?: boolean;
    onClose?: () => void;
    onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function RemoteServerPanel({
    visible = false,
    onClose,
    onResizeStart,
}: RemoteServerPanelProps) {
    const { t } = useTranslation();

    return (
        <aside
            className={cn('remote-server-panel', !visible && 'remote-server-panel--hidden')}
            aria-hidden={!visible}
        >
            {visible && (
                <div
                    className="remote-server-panel__resize-handle"
                    role="separator"
                    aria-label={t('settings.remoteServer.resizePanel')}
                    aria-orientation="vertical"
                    onPointerDown={onResizeStart}
                    tabIndex={0}
                />
            )}
            <header className="remote-server-panel__header">
                <div className="remote-server-panel__title">
                    <ServerIcon size={16} />
                    <span>{t('chatSideActions.remote')}</span>
                </div>
                <Button
                    type="button"
                    className="remote-server-panel__close"
                    onClick={onClose}
                    aria-label={t('settings.remoteServer.close')}
                >
                    {t('settings.remoteServer.close')}
                </Button>
            </header>
            <div className="remote-server-panel__body">
                <RemoteServerManager />
            </div>
        </aside>
    );
}

export type { RemoteServerPanelProps };
