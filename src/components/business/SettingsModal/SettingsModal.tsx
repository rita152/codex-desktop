/**
 * Settings Modal - Main Component
 */

import { useEffect, useCallback, useId, useState, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../../hooks/useSettings';
import { useSidebarResize } from '../../../hooks/useSidebarResize';
import { useModelFetch } from '../../../hooks/useModelFetch';
import { GeneralSettings, ShortcutSettings, RemoteSettings } from './sections';
import { List } from '../../ui/data-display/List';
import { ListItem } from '../../ui/data-display/ListItem';
import { Button } from '../../ui/data-entry/Button';
import { cn } from '../../../utils/cn';
import type { SettingsSection } from '../../../types/settings';
import type { SelectOption } from '../../ui/data-entry/Select/types';
import './SettingsModal.css';

const ModelSettings = lazy(() =>
  import('../ModelPanel').then((module) => ({ default: module.ModelPanel }))
);

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSection;
  /** 动态获取的可用模型列表 */
  availableModels?: SelectOption[];
  onModelOptionsResolved?: (payload: { options: SelectOption[]; currentId?: string }) => void;
}

// Navigation items configuration
const NAV_ITEMS: { id: SettingsSection; icon: string; labelKey: string; keywords: string[] }[] = [
  {
    id: 'general',
    icon: '📍',
    labelKey: 'settings.sections.general',
    keywords: ['language', 'theme', 'startup', '语言', '主题', '启动'],
  },
  {
    id: 'model',
    icon: '🤖',
    labelKey: 'settings.sections.model',
    keywords: ['api', 'token', 'openai', '模型'],
  },

  {
    id: 'remote',
    icon: '🌐',
    labelKey: 'settings.sections.remote',
    keywords: ['server', 'ssh', 'remote', '服务器', '远程'],
  },
  {
    id: 'shortcuts',
    icon: '⌨️',
    labelKey: 'settings.sections.shortcuts',
    keywords: ['keyboard', 'hotkey', 'shortcut', '快捷键', '键盘'],
  },
];

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const DEFAULT_SIDEBAR_WIDTH = 200;

export function SettingsModal({
  isOpen,
  onClose,
  initialSection,
  availableModels,
  onModelOptionsResolved,
}: SettingsModalProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const safeId = generatedId.replace(/:/g, '');
  const sidebarId = `settings-sidebar-${safeId}`;
  const [searchQuery, setSearchQuery] = useState('');
  const { settings, loading, activeSection, setActiveSection, updateSettings, saveStatus } =
    useSettings();
  const { fetching, fetchError, lastFetchedAt, fetchModels } = useModelFetch();

  const fetchStatus = useMemo(
    () => ({
      loading: fetching,
      error: fetchError ?? null,
      lastUpdated: lastFetchedAt ? lastFetchedAt.getTime() : null,
    }),
    [fetchError, fetching, lastFetchedAt]
  );

  const handleFetchModels = useCallback(async () => {
    try {
      const result = await fetchModels({ apiKey: settings.model.apiKey || undefined });
      onModelOptionsResolved?.(result);
    } catch {
      // handled by hook state
    }
  }, [fetchModels, onModelOptionsResolved, settings.model.apiKey]);

  const {
    width: sidebarWidth,
    isDragging: isSidebarDragging,
    sidebarRef,
    handleMouseDown,
    handleResizeKeyDown,
  } = useSidebarResize({
    minWidth: MIN_SIDEBAR_WIDTH,
    maxWidth: MAX_SIDEBAR_WIDTH,
    defaultWidth: DEFAULT_SIDEBAR_WIDTH,
  });

  const filteredNavItems = useMemo(() => {
    if (!searchQuery) return NAV_ITEMS;
    const query = searchQuery.toLowerCase();
    return NAV_ITEMS.filter((item) => {
      const label = t(item.labelKey).toLowerCase();
      const keywords = item.keywords.map((k) => k.toLowerCase());
      return label.includes(query) || keywords.some((k) => k.includes(query));
    });
  }, [searchQuery, t]);

  // Set initial section
  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection, setActiveSection]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Render save status
  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <span className="settings-modal__status settings-modal__status--saving">
            {t('settings.status.saving')}
          </span>
        );
      case 'saved':
        return (
          <span className="settings-modal__status settings-modal__status--saved">
            ✓ {t('settings.status.saved')}
          </span>
        );
      case 'error':
        return (
          <span className="settings-modal__status settings-modal__status--error">
            {t('settings.status.error')}
          </span>
        );
      default:
        return null;
    }
  };

  const lazyFallback = (
    <div className="settings-loading">
      <div className="settings-loading__spinner" />
      <span>{t('settings.loading')}</span>
    </div>
  );

  // Render active section content
  const renderContent = () => {
    if (loading) {
      return (
        <div className="settings-loading">
          <div className="settings-loading__spinner" />
          <span>{t('settings.loading')}</span>
        </div>
      );
    }

    switch (activeSection) {
      case 'general':
        return (
          <GeneralSettings
            settings={settings.general}
            onUpdate={(values) => updateSettings('general', values)}
          />
        );
      case 'model':
        return (
          <Suspense fallback={lazyFallback}>
            <ModelSettings
              settings={settings.model}
              onUpdate={(values) => updateSettings('model', values)}
              availableModels={availableModels}
              onFetchModels={handleFetchModels}
              fetchStatus={fetchStatus}
            />
          </Suspense>
        );

      case 'remote':
        return <RemoteSettings />;
      case 'shortcuts':
        return (
          <ShortcutSettings
            settings={settings.shortcuts}
            onUpdate={(values) => updateSettings('shortcuts', values)}
          />
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="settings-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="settings-modal">
        <aside
          id={sidebarId}
          ref={sidebarRef}
          className={cn('settings-sidebar', isSidebarDragging && 'settings-sidebar--dragging')}
          style={{ width: sidebarWidth }}
        >
          <nav className="settings-nav" role="navigation" aria-label={t('settings.navLabel')}>
            <div className="settings-nav__search">
              <input
                type="search"
                className="settings-input"
                placeholder={t('settings.search.placeholder')}
                aria-label={t('settings.search.ariaLabel')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {filteredNavItems.length > 0 ? (
              <List className="settings-nav__list" scrollable>
                {filteredNavItems.map((item) => (
                  <ListItem
                    key={item.id}
                    icon={
                      <span className="settings-nav__icon" aria-hidden="true">
                        {item.icon}
                      </span>
                    }
                    selected={activeSection === item.id}
                    onClick={() => setActiveSection(item.id)}
                    className="settings-nav__item"
                  >
                    {t(item.labelKey)}
                  </ListItem>
                ))}
              </List>
            ) : (
              <div className="settings-nav__no-results">{t('settings.search.noResults')}</div>
            )}
          </nav>
          <div
            className="settings-sidebar__resize-handle"
            onMouseDown={handleMouseDown}
            onKeyDown={handleResizeKeyDown}
            role="separator"
            aria-orientation="vertical"
            aria-label={t('sidebar.resizeAria')}
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuemax={MAX_SIDEBAR_WIDTH}
            aria-valuenow={Math.round(sidebarWidth)}
            aria-controls={sidebarId}
            tabIndex={0}
          />
        </aside>

        <section className="settings-panel">
          <header className="settings-modal__header">
            <h1 id="settings-modal-title" className="settings-modal__title">
              <span className="settings-modal__title-icon">⚙️</span>
              {t('settings.title')}
            </h1>
            <div className="settings-modal__header-actions">
              {renderSaveStatus()}
              <Button
                className="settings-modal__close"
                onClick={onClose}
                aria-label={t('settings.close')}
              >
                ✕
              </Button>
            </div>
          </header>

          <main className="settings-content" role="main">
            {renderContent()}
          </main>
        </section>
      </div>
    </div>
  );
}

export default SettingsModal;
