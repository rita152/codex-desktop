import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { ModelPanel } from './index';
import type { ModelSettings } from '../../../types/settings';
import { DEFAULT_SETTINGS } from '../../../types/settings';
import type { ModelOption } from '../../../types/options';

import '../SettingsModal/SettingsModal.css';
import './ModelPanel.stories.css';

const modelOptions: ModelOption[] = [
  {
    value: 'gpt-5.2-codex',
    label: 'GPT-5.2 Codex',
    supportedReasoningEfforts: [
      { effort: 'low', description: 'Fast responses with light reasoning' },
      { effort: 'medium', description: 'Balanced speed and reasoning depth' },
      { effort: 'high', description: 'Deeper reasoning for complex tasks' },
    ],
    defaultReasoningEffort: 'medium',
  },
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
];

const meta: Meta<typeof ModelPanel> = {
  title: 'Business/Settings/Model',
  component: ModelPanel,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ModelPanel>;

export const Default: Story = {
  render: () => {
    const [settings, setSettings] = useState<ModelSettings>({
      ...DEFAULT_SETTINGS.model,
      defaultModel: 'gpt-5.2-high',
    });

    return (
      <div className="model-panel-story">
        <ModelPanel
          settings={settings}
          availableModels={modelOptions}
          onUpdate={(values) => setSettings((prev) => ({ ...prev, ...values }))}
        />
      </div>
    );
  },
};
