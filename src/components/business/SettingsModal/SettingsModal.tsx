/**
 * Settings Modal - Main Component
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../../hooks/useSettings';
import {
    GeneralSettings,
    ModelSettings,
    ApprovalSettings,
    ShortcutSettings,
    AdvancedSettings,
    RemoteSettings,
} from './sections';
import type { SettingsSection } from '../../../types/settings';
import './SettingsModal.css';


interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialSection?: SettingsSection;
}

// Navigation items configuration
const NAV_ITEMS: { id: SettingsSection; icon: string; labelKey: string; keywords: string[] }[] = [
    { id: 'general', icon: '📍', labelKey: 'settings.sections.general', keywords: ['language', 'theme', 'startup', '语言', '主题', '启动'] },
    { id: 'model', icon: '🤖', labelKey: 'settings.sections.model', keywords: ['api', 'token', 'temperature', 'openai', '模型', '温度'] },
    { id: 'approval', icon: '🛡️', labelKey: 'settings.sections.approval', keywords: ['approve', 'command', 'trust', '审批', '命令', '信任'] },
    { id: 'remote', icon: '🌐', labelKey: 'settings.sections.remote', keywords: ['server', 'ssh', 'remote', '服务器', '远程'] },
    { id: 'shortcuts', icon: '⌨️', labelKey: 'settings.sections.shortcuts', keywords: ['keyboard', 'hotkey', 'shortcut', '快捷键', '键盘'] },
    { id: 'advanced', icon: '🔧', labelKey: 'settings.sections.advanced', keywords: ['debug', 'cache', 'reset', 'log', '调试', '缓存', '重置', '日志'] },
];

export function SettingsModal({ isOpen, onClose, initialSection }: SettingsModalProps) {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const {
        settings,
        loading,
        activeSection,
        setActiveSection,
        updateSettings,
        resetSettings,
        saveStatus,
    } = useSettings();

    // Filter navigation items based on search query
    const filteredNavItems = useMemo(() => {
        if (!searchQuery.trim()) return NAV_ITEMS;
        const query = searchQuery.toLowerCase();
        return NAV_ITEMS.filter(item => {
            const label = t(item.labelKey).toLowerCase();
            const matchesLabel = label.includes(query);
            const matchesKeywords = item.keywords.some(kw => kw.toLowerCase().includes(query));
            return matchesLabel || matchesKeywords;
        });
    }, [searchQuery, t]);

    // Auto-select first matching section when searching
    useEffect(() => {
        if (searchQuery.trim() && filteredNavItems.length > 0) {
            const currentSectionInResults = filteredNavItems.some(item => item.id === activeSection);
            if (!currentSectionInResults) {
                setActiveSection(filteredNavItems[0].id);
            }
        }
    }, [filteredNavItems, searchQuery, activeSection, setActiveSection]);

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
    const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

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
                    <ModelSettings
                        settings={settings.model}
                        onUpdate={(values) => updateSettings('model', values)}
                    />
                );
            case 'approval':
                return (
                    <ApprovalSettings
                        settings={settings.approval}
                        onUpdate={(values) => updateSettings('approval', values)}
                    />
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
            case 'advanced':
                return (
                    <AdvancedSettings
                        settings={settings.advanced}
                        onUpdate={(values) => updateSettings('advanced', values)}
                        onReset={resetSettings}
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
                {/* Header */}
                <header className="settings-modal__header">
                    <h1 id="settings-modal-title" className="settings-modal__title">
                        <span className="settings-modal__title-icon">⚙️</span>
                        {t('settings.title')}
                    </h1>
                    <div className="settings-modal__header-actions">
                        {renderSaveStatus()}
                        <button
                            className="settings-modal__close"
                            onClick={onClose}
                            aria-label={t('settings.close')}
                        >
                            ✕
                        </button>
                    </div>
                </header>

                {/* Body */}
                <div className="settings-modal__body">
                    {/* Navigation */}
                    <nav className="settings-nav" role="navigation" aria-label={t('settings.navLabel')}>
                        {/* Search Box */}
                        <div className="settings-nav__search">
                            <input
                                type="text"
                                className="settings-nav__search-input"
                                placeholder={t('settings.search.placeholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label={t('settings.search.ariaLabel')}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className="settings-nav__search-clear"
                                    onClick={() => setSearchQuery('')}
                                    aria-label={t('settings.search.clear')}
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Navigation Items */}
                        {filteredNavItems.length > 0 ? (
                            filteredNavItems.map((item) => (
                                <button
                                    key={item.id}
                                    className={`settings-nav__item ${activeSection === item.id ? 'settings-nav__item--active' : ''}`}
                                    onClick={() => setActiveSection(item.id)}
                                    aria-current={activeSection === item.id ? 'page' : undefined}
                                >
                                    <span className="settings-nav__icon">{item.icon}</span>
                                    <span>{t(item.labelKey)}</span>
                                </button>
                            ))
                        ) : (
                            <div className="settings-nav__empty">
                                {t('settings.search.noResults')}
                            </div>
                        )}
                    </nav>

                    {/* Content */}
                    <main className="settings-content" role="main">
                        {renderContent()}
                    </main>
                </div>
            </div>
        </div>
    );
}

export default SettingsModal;
