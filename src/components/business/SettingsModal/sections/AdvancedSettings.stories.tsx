import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { AdvancedSettings } from './AdvancedSettings';
import type { AppSettings } from '../../../../types/settings';
import { DEFAULT_SETTINGS } from '../../../../types/settings';

import '../SettingsModal.css';
import './SettingsSection.stories.css';

const meta: Meta<typeof AdvancedSettings> = {
  title: 'Business/Settings/Advanced',
  component: AdvancedSettings,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof AdvancedSettings>;

export const Default: Story = {
  render: () => {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

    return (
      <div className="settings-section-story">
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
      </div>
    );
  },
};
