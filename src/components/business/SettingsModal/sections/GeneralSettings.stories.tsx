import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { GeneralSettings } from './GeneralSettings';
import type { GeneralSettings as GeneralSettingsType } from '../../../../types/settings';
import { DEFAULT_SETTINGS } from '../../../../types/settings';

import '../SettingsModal.css';
import './SettingsSection.stories.css';

const meta: Meta<typeof GeneralSettings> = {
  title: 'Business/Settings/General',
  component: GeneralSettings,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof GeneralSettings>;

export const Default: Story = {
  render: () => {
    const [settings, setSettings] = useState<GeneralSettingsType>(DEFAULT_SETTINGS.general);

    return (
      <div className="settings-section-story">
        <GeneralSettings
          settings={settings}
          onUpdate={(values) => setSettings((prev) => ({ ...prev, ...values }))}
        />
      </div>
    );
  },
};
