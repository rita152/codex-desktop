import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { RemoteServerManager } from '../RemoteServerManager';

import { cn } from '../../../utils/cn';

import './RemoteServerPanel.css';

type RemoteServerPanelProps = {
  visible?: boolean;
  onClose?: () => void;
  onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function RemoteServerPanel({
  visible = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

      <div className="remote-server-panel__body">
        <RemoteServerManager hideTitle />
      </div>
    </aside>
  );
}

export type { RemoteServerPanelProps };
