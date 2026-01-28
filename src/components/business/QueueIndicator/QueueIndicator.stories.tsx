import type { Meta, StoryObj } from '@storybook/react';
import { QueueIndicator } from './index';
import type { QueuedMessage } from '../../../hooks/useMessageQueue';

const meta: Meta<typeof QueueIndicator> = {
  title: 'Business/QueueIndicator',
  component: QueueIndicator,
  tags: ['autodocs'],
  argTypes: {
    onRemove: { action: 'removed' },
    onMoveToTop: { action: 'moved to top' },
    onMore: { action: 'more clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof QueueIndicator>;

const mockQueue: QueuedMessage[] = [
  {
    id: '1',
    content: '圣诞季卡',
    timestamp: new Date(),
  },
  {
    id: '2',
    content: '刷卡地方你看',
    timestamp: new Date(),
  },
  {
    id: '3',
    content: '手机看到饭',
    timestamp: new Date(),
  },
];

export const Default: Story = {
  args: {
    queue: mockQueue,
  },
  render: (args) => (
    <div
      style={{
        padding: '40px',
        background: '#121212',
        minHeight: '300px',
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <QueueIndicator {...args} />
        {/* Mock Input Area */}
        <div
          style={{
            marginTop: '4px',
            background: '#1e1e1e',
            borderRadius: '12px',
            padding: '16px',
            color: '#666',
            border: '1px solid #333',
            fontSize: '14px',
          }}
        >
          要求后续变更
        </div>
      </div>
    </div>
  ),
};
