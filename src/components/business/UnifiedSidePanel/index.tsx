import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../../ui/data-entry/IconButton';
import {
  FolderIcon,
  GitBranchIcon,
  ServerIcon,
  TerminalIcon,
  CloseIcon,
} from '../../ui/data-display/Icon';
import { cn } from '../../../utils/cn';
import './UnifiedSidePanel.css';

const TerminalPanel = lazy(() =>
  import('../TerminalPanel').then((module) => ({ default: module.TerminalPanel }))
);

const RemoteServerPanel = lazy(() =>
  import('../RemoteServerPanel').then((module) => ({ default: module.RemoteServerPanel }))
);

const FileBrowserPanel = lazy(() =>
  import('../FileBrowserPanel').then((module) => ({ default: module.FileBrowserPanel }))
);

const GitPanel = lazy(() => import('../GitPanel').then((module) => ({ default: module.GitPanel })));

export type SidePanelTab = 'terminal' | 'git' | 'explorer' | 'remote';

interface UnifiedSidePanelProps {
  activeTab: SidePanelTab;
  onTabChange: (tab: SidePanelTab) => void;
  onClose: () => void;
  width: number;
  onResizeStart: (e: React.PointerEvent<HTMLDivElement>) => void;

  // Panel specific props
  terminalId: string | null;

  sessionCwd: string;
  onFileSelect: (path: string) => void;
}

export function UnifiedSidePanel({
  activeTab,
  onTabChange,
  onClose,
  width,
  onResizeStart,
  terminalId,
  sessionCwd,
  onFileSelect,
}: UnifiedSidePanelProps) {
  const { t } = useTranslation();

  const tabs = useMemo<Array<{ id: SidePanelTab; label: string; icon: ReactNode }>>(
    () => [
      { id: 'explorer', label: t('chatSideActions.explorer'), icon: <FolderIcon size={14} /> },
      { id: 'git', label: t('chatSideActions.git'), icon: <GitBranchIcon size={14} /> },
      { id: 'terminal', label: t('chatSideActions.terminal'), icon: <TerminalIcon size={14} /> },
      { id: 'remote', label: t('chatSideActions.remote'), icon: <ServerIcon size={14} /> },
    ],
    [t]
  );

  const [mountedTabs, setMountedTabs] = useState<SidePanelTab[]>([activeTab]);

  useEffect(() => {
    setMountedTabs((prev) => (prev.includes(activeTab) ? prev : [...prev, activeTab]));
  }, [activeTab]);

  const renderPanel = (tabId: SidePanelTab, content: ReactNode) => {
    if (!mountedTabs.includes(tabId)) return null;
    return (
      <div
        className={cn(
          'unified-side-panel__view',
          activeTab !== tabId && 'unified-side-panel__view--hidden'
        )}
      >
        <Suspense fallback={null}>{content}</Suspense>
      </div>
    );
  };

  return (
    <div className="unified-side-panel" style={{ width }}>
      <div className="unified-side-panel__resize-handle" onPointerDown={onResizeStart} />

      <div className="unified-side-panel__header">
        <div className="unified-side-panel__tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={cn(
                'unified-side-panel__tab',
                activeTab === tab.id && 'unified-side-panel__tab--active'
              )}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              aria-label={tab.label}
              aria-selected={activeTab === tab.id}
            >
              {tab.icon}
            </button>
          ))}
        </div>

        <div className="unified-side-panel__actions">
          <IconButton
            icon={<CloseIcon size={16} />}
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label={t('common.close')}
          />
        </div>
      </div>

      <div className="unified-side-panel__content">
        {renderPanel(
          'terminal',
          <TerminalPanel terminalId={terminalId} visible={activeTab === 'terminal'} />
        )}

        {renderPanel('git', <GitPanel visible={activeTab === 'git'} cwd={sessionCwd} />)}

        {renderPanel(
          'explorer',
          <FileBrowserPanel
            visible={activeTab === 'explorer'}
            cwd={sessionCwd}
            onFileSelect={onFileSelect}
          />
        )}

        {renderPanel('remote', <RemoteServerPanel visible={activeTab === 'remote'} />)}
      </div>
    </div>
  );
}
