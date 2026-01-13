import type { Meta, StoryObj } from '@storybook/react';

import { GitDiff } from './index';

const sampleDiff = `diff --git a/src/utils/helper.ts b/src/utils/helper.ts
index 1234567..abcdefg 100644
--- a/src/utils/helper.ts
+++ b/src/utils/helper.ts
@@ -1,8 +1,10 @@
-export function greet(name: string) {
-  return 'Hello, ' + name;
+export function greet(name: string, greeting = 'Hello') {
+  return \`\${greeting}, \${name}!\`;
 }
 
 export function add(a: number, b: number) {
   return a + b;
 }
+
+export const VERSION = '1.0.0';`;

const meta: Meta<typeof GitDiff> = {
  title: 'UI/GitDiff',
  component: GitDiff,
  tags: ['autodocs'],
  argTypes: {
    showLineNumbers: {
      control: 'boolean',
      description: '是否显示行号',
    },
    fileName: {
      control: 'text',
      description: '文件名（覆盖从 diff 解析的文件名）',
    },
  },
};

export default meta;
type Story = StoryObj<typeof GitDiff>;

export const Default: Story = {
  args: {
    diff: sampleDiff,
    showLineNumbers: true,
  },
};
