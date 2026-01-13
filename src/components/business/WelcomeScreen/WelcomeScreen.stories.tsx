import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { WelcomeScreen } from './index';
import { ChatInput } from '../ChatInput';

const meta: Meta<typeof WelcomeScreen> = {
  title: 'Business/WelcomeScreen',
  component: WelcomeScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    appName: {
      control: 'text',
      description: '应用名称',
    },
  },
};

export default meta;
type Story = StoryObj<typeof WelcomeScreen>;

function WelcomeWithInput() {
  const [value, setValue] = useState('');
  return (
    <WelcomeScreen>
      <ChatInput
        value={value}
        onChange={setValue}
        onSend={(msg) => console.log('Send:', msg)}
        placeholder="输入消息开始对话..."
      />
    </WelcomeScreen>
  );
}

export const Default: Story = {
  render: () => <WelcomeWithInput />,
};
