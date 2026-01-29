import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { useTranslation } from 'react-i18next';

import { List } from '../../ui/data-display/List';
import { ListItem } from '../../ui/data-display/ListItem';
import {
  CheckIcon,
  EditIcon,
  RobotIcon,
  ServerIcon,
  SettingsIcon,
  SlidersIcon,
} from '../../ui/data-display/Icon';
import {
  AdvancedSettings,
  ApprovalSettings,
  GeneralSettings,
  RemoteSettings,
  ShortcutSettings,
} from './sections';
import { ModelPanel as ModelSettings } from '../ModelPanel';
import type { AppSettings, SettingsSection } from '../../../types/settings';
import { DEFAULT_SETTINGS } from '../../../types/settings';
import type { SelectOption } from '../../ui/data-entry/Select/types';

import './SettingsModal.css';

const meta: Meta<typeof SettingsPanelStory> = {
  title: 'Business/SettingsPanel',
  component: SettingsPanelStory,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof SettingsPanelStory>;

type NavItem = {
  id: SettingsSection;
  labelKey: string;
  icon: ReactNode;
};

const modelOptions: SelectOption[] = [
  { value: 'gpt-5.2-high', label: 'GPT-5.2 High' },
  { value: 'gpt-5.2-mini', label: 'GPT-5.2 Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
];

function SettingsPanelStory() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  const navItems = useMemo<NavItem[]>(
    () => [
      { id: 'general', labelKey: 'settings.sections.general', icon: <SettingsIcon size={16} /> },
      { id: 'model', labelKey: 'settings.sections.model', icon: <RobotIcon size={16} /> },
      { id: 'approval', labelKey: 'settings.sections.approval', icon: <CheckIcon size={16} /> },
      { id: 'remote', labelKey: 'settings.sections.remote', icon: <ServerIcon size={16} /> },
      { id: 'shortcuts', labelKey: 'settings.sections.shortcuts', icon: <EditIcon size={16} /> },
      { id: 'advanced', labelKey: 'settings.sections.advanced', icon: <SlidersIcon size={16} /> },
    ],
    []
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <GeneralSettings
            settings={settings.general}
            onUpdate={(values) =>
              setSettings((prev) => ({
                ...prev,
                general: { ...prev.general, ...values },
              }))
            }
          />
        );
      case 'model':
        return (
          <ModelSettings
            settings={settings.model}
            availableModels={modelOptions}
            onUpdate={(values) =>
              setSettings((prev) => ({
                ...prev,
                model: { ...prev.model, ...values },
              }))
            }
          />
        );
      case 'approval':
        return (
          <ApprovalSettings
            settings={settings.approval}
            onUpdate={(values) =>
              setSettings((prev) => ({
                ...prev,
                approval: { ...prev.approval, ...values },
              }))
            }
          />
        );
      case 'remote':
        return <RemoteSettings />;
      case 'shortcuts':
        return (
          <ShortcutSettings
            settings={settings.shortcuts}
            onUpdate={(values) =>
              setSettings((prev) => ({
                ...prev,
                shortcuts: { ...prev.shortcuts, ...values },
              }))
            }
          />
        );
      case 'advanced':
        return (
          <AdvancedSettings
            settings={settings.advanced}
            onUpdate={(values) =>
              setSettings((prev) => ({
                ...prev,
                advanced: { ...prev.advanced, ...values },
              }))
            }
            onReset={async () => {
              setSettings(DEFAULT_SETTINGS);
            }}
            onExportSettings={() => settings}
            onImportSettings={(next) => setSettings(next)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal">
        <aside className="settings-sidebar" style={{ width: 240 }}>
          <nav className="settings-nav" role="navigation" aria-label={t('settings.navLabel')}>
            <List className="settings-nav__list" scrollable>
              {navItems.map((item) => (
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
          </nav>
        </aside>

        <section className="settings-panel">
          <header className="settings-modal__header">
            <h1 className="settings-modal__title">
              <span className="settings-modal__title-icon">
                <SettingsIcon size={18} />
              </span>
              {t('settings.title')}
            </h1>
            <div className="settings-modal__header-actions">
              <span className="settings-modal__status">Story preview</span>
              <button
                type="button"
                className="settings-modal__close"
                aria-label={t('settings.close')}
              >
                x
              </button>
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

export const Default: Story = {
  render: () => <SettingsPanelStory />,
};
