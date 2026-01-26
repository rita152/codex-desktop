import { useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../../ui/data-entry/IconButton';
import {
    CodeIcon,
    FolderIcon,
    NotebookIcon,
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

export type SidePanelTab = 'terminal' | 'git' | 'explorer' | 'remote' | 'files';

interface UnifiedSidePanelProps {
    activeTab: SidePanelTab;
    onTabChange: (tab: SidePanelTab) => void;
    onClose: () => void;
    width: number;
    onResizeStart: (e: React.PointerEvent<HTMLDivElement>) => void;

    // Panel specific props
    terminalId: string | null;
    onTerminalClose: () => void; // Maybe not needed if we just switch tabs?

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

    const tabs = useMemo(() => [
        { id: 'files', label: t('chatSideActions.files'), icon: <CodeIcon size={14} /> },
        { id: 'explorer', label: t('chatSideActions.explorer'), icon: <FolderIcon size={14} /> },
        { id: 'git', label: t('chatSideActions.git'), icon: <NotebookIcon size={14} /> },
        { id: 'terminal', label: t('chatSideActions.terminal'), icon: <TerminalIcon size={14} /> },
        { id: 'remote', label: t('chatSideActions.remote'), icon: <ServerIcon size={14} /> },
    ], [t]);

    // Determine current title based on active tab
    // const activeTabInfo = tabs.find(t => t.id === activeTab);
    // const title = activeTabInfo ? activeTabInfo.label : '';

    return (
        <div
            className="unified-side-panel"
            style={{ width }}
        >
            <div
                className="unified-side-panel__resize-handle"
                onPointerDown={onResizeStart}
            />

            <div className="unified-side-panel__header">
                <div className="unified-side-panel__tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={cn(
                                'unified-side-panel__tab',
                                activeTab === tab.id && 'unified-side-panel__tab--active'
                            )}
                            onClick={() => onTabChange(tab.id as SidePanelTab)}
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
                <Suspense fallback={<div className="p-4 text-secondary">Loading...</div>}>
                    <div style={{ display: activeTab === 'terminal' ? 'block' : 'none', height: '100%' }}>
                        <TerminalPanel
                            terminalId={terminalId}
                            visible={true} // Always "visible" to component logic if we are just hiding it with CSS
                            onClose={() => { }} // TerminalPanel's internal close button might need handling or hiding
                            onResizeStart={() => { }} // Handle resize at unified level
                        />
                    </div>

                    {activeTab === 'git' && (
                        <GitPanel
                            visible={true}
                            cwd={sessionCwd}
                            onClose={() => { }}
                            onResizeStart={() => { }}
                        />
                    )}

                    {activeTab === 'explorer' && (
                        <FileBrowserPanel
                            visible={true}
                            cwd={sessionCwd}
                            onClose={() => { }}
                            onResizeStart={() => { }}
                            onFileSelect={onFileSelect}
                        />
                    )}

                    {activeTab === 'remote' && (
                        <RemoteServerPanel
                            visible={true}
                            onClose={() => { }}
                            onResizeStart={() => { }}
                        />
                    )}

                    {activeTab === 'files' && (
                        <div className="p-4 text-center text-secondary">
                            Files implementation stub
                        </div>
                    )}
                </Suspense>
            </div>
        </div>
    );
}
