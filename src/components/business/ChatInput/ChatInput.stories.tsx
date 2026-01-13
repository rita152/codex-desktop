import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { ChatInput } from './index';

const meta: Meta<typeof ChatInput> = {
  title: 'Business/ChatInput',
  component: ChatInput,
  tags: ['autodocs'],
  argTypes: {
    disabled: {
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
      <div style={{ padding: '20px' }}>
        <ChatInput
          {...args}
          value={value}
          onChange={setValue}
          onSend={(msg) => {
            console.log('发送:', msg);
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
