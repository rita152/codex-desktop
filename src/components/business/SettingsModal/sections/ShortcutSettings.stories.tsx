import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { ShortcutSettings } from './ShortcutSettings';
import type { ShortcutSettings as ShortcutSettingsType } from '../../../../types/settings';
import { DEFAULT_SETTINGS } from '../../../../types/settings';

import '../SettingsModal.css';
import './SettingsSection.stories.css';

const meta: Meta<typeof ShortcutSettings> = {
  title: 'Business/Settings/Shortcuts',
  component: ShortcutSettings,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ShortcutSettings>;

export const Default: Story = {
  render: () => {
    const [settings, setSettings] = useState<ShortcutSettingsType>(
      DEFAULT_SETTINGS.shortcuts
    );

    return (
      <div className="settings-section-story">
        <ShortcutSettings
          settings={settings}
          onUpdate={(values) => setSettings((prev) => ({ ...prev, ...values }))}
        />
      </div>
    );
  },
};
