---
inclusion: fileMatch
fileMatchPattern: ['src/**/*.tsx', 'src/**/*.ts', 'src/**/*.css']
---

# 前端开发规范

## 组件架构

### 三层组件结构

| 层级     | 位置                       | 职责                             |
| -------- | -------------------------- | -------------------------------- |
| UI 组件  | `src/components/ui/`       | 纯展示，无业务逻辑，只接收 props |
| 业务组件 | `src/components/business/` | 组合 UI 组件，包含业务逻辑       |
| 页面组件 | `src/`                     | 路由级别，负责数据获取和状态编排 |

### 组件文件结构

```
src/components/ui/Button/
├── index.tsx           # 组件实现（默认导出 + 命名导出）
├── Button.css          # 组件样式（CSS Modules 或组件级 CSS）
├── types.ts            # TypeScript 类型定义
└── Button.stories.tsx  # Storybook stories（必须）
```

### Storybook Stories 规范

每个 UI 组件和业务组件**必须**编写对应的 stories 文件，**每个组件只保留一个 story**。

#### 文件命名

- 格式：`组件名.stories.tsx`
- 位置：与组件同目录

#### Stories 结构

```tsx
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './index';

const meta: Meta<typeof Button> = {
  title: 'UI/Button', // UI 组件用 'UI/'，业务组件用 'Business/'
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// 每个组件只保留一个默认 story，通过 argTypes 控制不同状态
export const Default: Story = {
  args: {
    children: '按钮',
    variant: 'primary',
  },
};
```

#### 规则

- 每个组件**只导出一个** `Default` story
- 通过 `argTypes` 定义可控制的 props，在 Storybook 中切换状态
- 添加 `tags: ['autodocs']` 自动生成文档

### 组件设计规则

- 单一职责：一个组件只做一件事
- 通过 props 和回调通信，禁止组件间直接引用
- 禁止子组件直接修改父组件传入的 props
- 禁止使用 `any` 类型，必须定义明确的 TypeScript 接口

## 前后端分离

### 数据层结构

```
src/
├── api/           # Tauri invoke 封装层
├── hooks/         # 数据获取 hooks（useXxx.ts）
├── types/         # 前后端共享类型定义
└── components/    # 纯 UI 组件（禁止直接调用 API）
```

### API 调用规则

- **禁止**：组件直接调用 `invoke()`
- **必须**：通过 `api/` 层或自定义 hooks 调用后端

```tsx
// ✅ 正确
const { users, loading, error } = useUsers();

// ❌ 错误
useEffect(() => {
  invoke('get_users').then(setUsers);
}, []);
```

## 状态管理

| 类型       | 方式         | 使用场景                   |
| ---------- | ------------ | -------------------------- |
| 本地状态   | `useState`   | 仅影响当前组件             |
| 共享状态   | Context      | 跨组件共享                 |
| 服务端状态 | 自定义 hooks | 后端数据，含 loading/error |

原则：优先本地状态，避免过度全局化；禁止存储可从 props 派生的状态。

## 命名规范

### 文件命名

- 组件：`PascalCase.tsx`（如 `UserProfile.tsx`）
- Hooks：`camelCase.ts`，use 开头（如 `useAuth.ts`）
- 工具/类型/常量：`camelCase.ts`

### 代码命名

```tsx
function UserCard() {} // 组件：PascalCase
function useUserData() {} // Hook：use 开头
const handleClick = () => {}; // 事件处理：handle + 动作
const isLoading = true; // 布尔值：is/has/can/should 开头
const MAX_RETRY_COUNT = 3; // 常量：UPPER_SNAKE_CASE
```

### 事件命名

- 组件内部：`handle` + 名词 + 动词（`handleButtonClick`）
- Props 回调：`on` + 名词 + 动词（`onItemSelect`）

## 导入顺序

按以下顺序组织，各组之间空一行：

1. React 相关
2. 第三方库（`@tauri-apps/api` 等）
3. 内部模块（api、hooks、utils）
4. 组件
5. 类型（`import type`）
6. 样式

## 错误处理

### API 层

```tsx
async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const data = await invoke<User>('get_user', { id });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return { success: false, error: normalizeError(error) };
  }
}
```

### 规则

- 页面级组件必须包裹 ErrorBoundary
- 不吞掉错误，至少记录日志
- 用户可见错误需友好提示

## 性能优化

### 使用时机

| 优化手段      | 适用场景                | 避免场景                    |
| ------------- | ----------------------- | --------------------------- |
| `React.memo`  | 稳定 props 的纯展示组件 | props 频繁变化或含 children |
| `useMemo`     | 计算开销大的值          | 简单计算                    |
| `useCallback` | 作为依赖传递的回调      | 不作为依赖传递              |

### 规则

- 先测量后优化，避免过早优化
- 列表渲染必须提供稳定的 `key`
- 大列表考虑虚拟滚动

## 条件渲染

```tsx
// ✅ 简单条件：短路运算或三元
{
  isVisible && <Modal />;
}
{
  isLoading ? <Spinner /> : <Content />;
}

// ✅ 复杂条件：提取为变量
const showEmptyState = !isLoading && items.length === 0;

// ❌ 避免：嵌套三元
{
  isLoading ? <Spinner /> : error ? <Error /> : <Content />;
}
```

## 注释规范

- 注释解释"为什么"，不是"是什么"
- 使用 `TODO:`、`FIXME:`、`HACK:` 标记
- 删除无用注释和注释掉的代码
- 公共函数使用 JSDoc 格式

## 样式规范

### 颜色使用

- **禁止**在组件中直接定义颜色值
- **必须**使用全局 CSS 变量定义的颜色

```css
/* ✅ 正确：使用全局颜色变量 */
.button {
  background-color: var(--color-primary);
  color: var(--color-text);
  border-color: var(--color-border);
}

.error-message {
  color: var(--color-error);
}

/* ❌ 错误：直接写颜色值 */
.button {
  background-color: #3b82f6;
  color: white;
  border-color: rgb(229, 231, 235);
}

.error-message {
  color: red;
}
```

### 全局颜色变量位置

- 颜色变量定义在 `src/styles/variables.css` 或根级 CSS 文件
- 按用途分类：主色、文字色、背景色、边框色、状态色等

```css
:root {
  /* 主色 */
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;

  /* 文字 */
  --color-text: #1f2937;
  --color-text-secondary: #6b7280;

  /* 背景 */
  --color-bg: #ffffff;
  --color-bg-secondary: #f3f4f6;

  /* 边框 */
  --color-border: #e5e7eb;

  /* 状态 */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
}
```

### 原则

- 新增颜色需求先检查是否有合适的现有变量
- 确需新增颜色时，添加到全局变量文件，不要在组件中定义
- 保持颜色命名语义化，按用途而非色值命名
