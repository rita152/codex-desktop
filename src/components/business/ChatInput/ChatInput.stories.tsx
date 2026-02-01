import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { ChatInput } from './index';
import { devDebug } from '../../../utils/logger';

import './ChatInput.stories.css';

const meta: Meta<typeof ChatInput> = {
  title: 'Business/ChatInput',
  component: ChatInput,
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
    },
    isGenerating: {
      control: 'boolean',
    },
    width: {
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChatInput>;

export const Default: Story = {
  args: {
    placeholder: '',
    width: 600,
  },
  render: (args) => {
    const [value, setValue] = useState('');
    const [agent, setAgent] = useState('agent');
    const [model, setModel] = useState('gpt-5.2-high');

    return (
      <div className="chat-input-story__container">
        <ChatInput
          {...args}
          value={value}
          onChange={setValue}
          onSend={(msg) => {
            devDebug('发送:', msg);
            setValue('');
          }}
          selectedAgent={agent}
          onAgentChange={setAgent}
          selectedModel={model}
          onModelChange={setModel}
        />
      </div>
    );
  },
};

/** Shows the generating state with cancel button */
export const Generating: Story = {
  args: {
    placeholder: '',
    width: 600,
    isGenerating: true,
  },
  render: (args) => {
    const [value, setValue] = useState('');
    const [agent, setAgent] = useState('agent');
    const [model, setModel] = useState('gpt-5.2-high');
    const [isGenerating, setIsGenerating] = useState(args.isGenerating ?? true);

    return (
      <div className="chat-input-story__container">
        <p style={{ marginBottom: 16, color: 'var(--color-text-secondary)' }}>
          When generating, the send button turns blue and becomes a cancel button. Hover to see the
          red cancel state.
        </p>
        <ChatInput
          {...args}
          value={value}
          onChange={setValue}
          isGenerating={isGenerating}
          onCancel={() => {
            devDebug('Cancel clicked');
            setIsGenerating(false);
          }}
          onSend={(msg) => {
            devDebug('发送:', msg);
            setValue('');
            setIsGenerating(true);
          }}
          selectedAgent={agent}
          onAgentChange={setAgent}
          selectedModel={model}
          onModelChange={setModel}
        />
      </div>
    );
  },
};
