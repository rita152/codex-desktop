import type { Meta, StoryObj } from '@storybook/react';

import { Markdown } from './index';

const meta: Meta<typeof Markdown> = {
  title: 'UI/Markdown',
  component: Markdown,
  tags: ['autodocs'],
  argTypes: {
    content: {
      control: 'text',
      description: 'Markdown 内容',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Markdown>;

const sampleContent = `# Markdown 示例

这是一段普通文本，包含 **粗体**、*斜体* 和 ~~删除线~~。

## 代码

行内代码：\`const x = 1;\`

代码块：

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

## 列表

- 无序列表项 1
- 无序列表项 2
  - 嵌套项

1. 有序列表项 1
2. 有序列表项 2

## 引用

> 这是一段引用文本。
> 可以有多行。

## 表格

| 名称 | 类型 | 描述 |
|------|------|------|
| id | string | 唯一标识 |
| name | string | 名称 |

## 链接

[访问 GitHub](https://github.com)
`;

export const Default: Story = {
  args: {
    content: sampleContent,
  },
};
