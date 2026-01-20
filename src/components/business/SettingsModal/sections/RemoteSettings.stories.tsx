import type { Meta, StoryObj } from '@storybook/react';

import { RemoteSettings } from './RemoteSettings';

import '../SettingsModal.css';
import './SettingsSection.stories.css';

const meta: Meta<typeof RemoteSettings> = {
  title: 'Business/Settings/Remote',
  component: RemoteSettings,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof RemoteSettings>;

export const Default: Story = {
  render: () => (
    <div className="settings-section-story">
      <RemoteSettings />
    </div>
  ),
};
