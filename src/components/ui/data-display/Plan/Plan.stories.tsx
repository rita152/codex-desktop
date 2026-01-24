import type { Meta, StoryObj } from '@storybook/react';
import { Plan } from './index';

const meta: Meta<typeof Plan> = {
    title: 'UI/Display/Plan',
    component: Plan,
    tags: ['autodocs'],
    argTypes: {
        title: { control: 'text' },
    },
};

export default meta;
type Story = StoryObj<typeof Plan>;

const defaultSteps = [
    {
        id: '1',
        title: 'Analyze User Request',
        description: 'Understanding the intent and context of the user query.',
        status: 'completed' as const,
    },
    {
        id: '2',
        title: 'Scan Codebase',
        description: 'Searching for relevant files and patterns.',
        status: 'active' as const,
    },
    {
        id: '3',
        title: 'Generate Plan',
        description: 'Creating a step-by-step execution plan.',
        status: 'pending' as const,
    },
    {
        id: '4',
        title: 'Execute Changes',
        description: 'Applying edits to the files.',
        status: 'pending' as const,
    },
];

export const Default: Story = {
    args: {
        title: 'Execution Plan',
        steps: defaultSteps,
    },
};

export const Completed: Story = {
    args: {
        title: 'Execution Plan',
        steps: defaultSteps.map((s) => ({ ...s, status: 'completed' as const })),
    },
};

export const WithError: Story = {
    args: {
        title: 'Execution Plan',
        steps: [
            ...defaultSteps.slice(0, 1),
            {
                id: '2',
                title: 'Scan Codebase',
                description: 'Failed to access file system permission.',
                status: 'error' as const,
            },
            ...defaultSteps.slice(2),
        ],
    },
};
