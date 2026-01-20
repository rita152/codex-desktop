import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { ApprovalSettings } from './ApprovalSettings';
import type { ApprovalSettings as ApprovalSettingsType } from '../../../../types/settings';
import { DEFAULT_SETTINGS } from '../../../../types/settings';

import '../SettingsModal.css';
import './SettingsSection.stories.css';

const meta: Meta<typeof ApprovalSettings> = {
  title: 'Business/Settings/Approval',
  component: ApprovalSettings,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ApprovalSettings>;

export const Default: Story = {
  render: () => {
    const [settings, setSettings] = useState<ApprovalSettingsType>(
      DEFAULT_SETTINGS.approval
    );

    return (
      <div className="settings-section-story">
        <ApprovalSettings
          settings={settings}
          onUpdate={(values) => setSettings((prev) => ({ ...prev, ...values }))}
        />
      </div>
    );
  },
};
