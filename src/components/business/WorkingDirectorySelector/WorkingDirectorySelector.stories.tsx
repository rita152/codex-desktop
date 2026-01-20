import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { WorkingDirectorySelector } from './index';

const meta: Meta<typeof WorkingDirectorySelector> = {
  title: 'Business/WorkingDirectorySelector',
  component: WorkingDirectorySelector,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof WorkingDirectorySelector>;

export const Default: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    const [cwd, setCwd] = useState('/Users/demo/project');

    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--color-bg-secondary)',
          padding: 'var(--spacing-xl)',
        }}
      >
        {!isOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="button"
              style={{
                alignSelf: 'flex-start',
                padding: '10px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              onClick={() => setIsOpen(true)}
            >
              Open selector
            </button>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
              Current: {cwd}
            </div>
          </div>
        )}
        <WorkingDirectorySelector
          isOpen={isOpen}
          currentCwd={cwd}
          onClose={() => setIsOpen(false)}
          onSelect={(next) => {
            setCwd(next);
            setIsOpen(false);
          }}
        />
      </div>
    );
  },
};
