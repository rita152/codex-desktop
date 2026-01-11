import type { Meta, StoryObj } from '@storybook/react';

import { Card } from './index';

const meta: Meta<typeof Card> = {
  title: 'UI/DataDisplay/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    shadow: {
      control: 'boolean',
    },
    bordered: {
      control: 'boolean',
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
    radius: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg', 'xl', 'full'],
    },
    borderWidth: {
      control: 'select',
      options: ['thin', 'medium', 'thick', 'bold'],
    },
    background: {
      control: 'select',
      options: ['default', 'secondary', 'elevated', 'muted', 'subtle'],
    },
    width: {
      control: 'text',
    },
    height: {
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: null,
    shadow: false,
    bordered: true,
    padding: 'md',
    radius: 'md',
    borderWidth: 'thin',
    background: 'elevated',
    width: '200px',
    height: '120px',
  },
};
