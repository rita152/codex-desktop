/**
 * Settings Modal - Main Component
 */

import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../../hooks/useSettings';
import {
    GeneralSettings,
    ModelSettings,
    ApprovalSettings,
    ShortcutSettings,
    AdvancedSettings,
} from './sections';
import type { SettingsSection } from '../../../types/settings';
import './SettingsModal.css';


interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialSection?: SettingsSection;
}

// Navigation items configuration
const NAV_ITEMS: { id: SettingsSection; icon: string; labelKey: string }[] = [
    { id: 'general', icon: '📍', labelKey: 'settings.sections.general' },
    { id: 'model', icon: '🤖', labelKey: 'settings.sections.model' },
    { id: 'approval', icon: '🛡️', labelKey: 'settings.sections.approval' },
    { id: 'shortcuts', icon: '⌨️', labelKey: 'settings.sections.shortcuts' },
    { id: 'advanced', icon: '🔧', labelKey: 'settings.sections.advanced' },
];

export function SettingsModal({ isOpen, onClose, initialSection }: SettingsModalProps) {
    const { t } = useTranslation();
    const {
        settings,
        loading,
        activeSection,
        setActiveSection,
        updateSettings,
        resetSettings,
        saveStatus,
    } = useSettings();

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
                        {NAV_ITEMS.map((item) => (
                            <button
                                key={item.id}
                                className={`settings-nav__item ${activeSection === item.id ? 'settings-nav__item--active' : ''}`}
                                onClick={() => setActiveSection(item.id)}
                                aria-current={activeSection === item.id ? 'page' : undefined}
                            >
                                <span className="settings-nav__icon">{item.icon}</span>
                                <span>{t(item.labelKey)}</span>
                            </button>
                        ))}
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
