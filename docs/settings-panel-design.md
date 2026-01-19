# 设置面板 (Settings Panel) 设计文档

## 1. 概述

设置面板是 Codex Desktop 应用的配置中心，用户可以在这里管理应用程序的各种设置选项。设计风格将与现有前端保持一致，采用简洁、现代的 UI 设计，支持亮色/暗色模式自适应。

---

## 2. 设计原则

### 2.1 风格一致性
- 使用项目现有的 CSS 变量系统（`variables.css`）
- 遵循现有组件的圆角规范（`--radius-sm` 到 `--radius-xl`）
- 使用统一的间距系统（`--spacing-xs` 到 `--spacing-2xl`）
- 保持与 Sidebar、RemoteServerManager 等组件一致的视觉风格

### 2.2 交互模式
- 模态对话框形式呈现，覆盖在主界面之上
- 毛玻璃背景遮罩，保持上下文感知
- 支持键盘快捷键关闭（Escape）
- 分类导航 + 详情面板的布局结构

### 2.3 响应式设计
- 桌面端：左右分栏布局（导航 + 内容）
- 小屏幕：垂直堆叠布局或抽屉式导航

---

## 3. 功能模块设计

### 3.1 设置分类

#### 📍 **通用设置 (General)**
| 设置项 | 类型 | 说明 |
|--------|------|------|
| 语言 (Language) | 下拉选择 | 界面语言选择：简体中文 / English |
| 主题 (Theme) | 单选按钮组 | 浅色 / 深色 / 跟随系统 |
| 启动时行为 | 下拉选择 | 打开上次会话 / 新建会话 / 显示欢迎页 |
| 工作目录历史 | 列表管理 | 显示最近使用的工作目录，可清除 |

#### 🤖 **模型设置 (Model)**
| 设置项 | 类型 | 说明 |
|--------|------|------|
| 默认模型 | 下拉选择 | 选择默认使用的 AI 模型 |
| API Provider | 下拉选择 | OpenAI / Azure / Custom |
| API Base URL | 文本输入 | 自定义 API 端点（可选） |
| API Key | 密码输入 | API 密钥配置 |
| 最大 Token 数 | 数字输入 | 单次请求的最大 token 限制 |
| 温度 (Temperature) | 滑块 | 0.0 - 2.0，控制输出随机性 |

#### 🛡️ **审批策略 (Approval Policy)**
| 设置项 | 类型 | 说明 |
|--------|------|------|
| 默认审批模式 | 下拉选择 | 全部审批 / 仅危险操作 / 自动同意 |
| 文件写入 | 开关 | 是否需要审批文件写入操作 |
| 命令执行 | 开关 | 是否需要审批 shell 命令执行 |
| 文件删除 | 开关 | 是否需要审批删除操作 |
| 网络请求 | 开关 | 是否需要审批网络请求 |
| 信任的命令列表 | 列表编辑 | 无需审批的命令白名单 |

#### 🌐 **远程服务器 (Remote Servers)**
| 设置项 | 类型 | 说明 |
|--------|------|------|
| 服务器列表 | 卡片列表 | 已配置的远程服务器 |
| 添加服务器 | 按钮 | 打开添加服务器对话框 |
| 默认远程目录 | 文本输入 | 连接远程服务器后的默认工作目录 |
| SSH 超时时间 | 数字输入 | 连接超时时间（秒） |

#### ⌨️ **快捷键 (Keyboard Shortcuts)**
| 设置项 | 类型 | 说明 |
|--------|------|------|
| 新建会话 | 快捷键录入 | 默认: Cmd/Ctrl + N |
| 发送消息 | 快捷键录入 | 默认: Enter 或 Cmd/Ctrl + Enter |
| 停止生成 | 快捷键录入 | 默认: Escape |
| 打开设置 | 快捷键录入 | 默认: Cmd/Ctrl + , |
| 切换侧边栏 | 快捷键录入 | 默认: Cmd/Ctrl + B |
| 切换终端 | 快捷键录入 | 默认: Cmd/Ctrl + ` |

#### 🔧 **高级设置 (Advanced)**
| 设置项 | 类型 | 说明 |
|--------|------|------|
| 开发者模式 | 开关 | 启用额外的调试信息 |
| 日志级别 | 下拉选择 | Error / Warn / Info / Debug |
| 会话历史限制 | 数字输入 | 保留的最大会话数量 |
| 清除缓存 | 按钮 | 清除本地缓存数据 |
| 重置设置 | 按钮 | 恢复所有设置为默认值 |
| 数据导出 | 按钮 | 导出设置和会话数据 |
| 数据导入 | 按钮 | 从文件导入设置 |

---

## 4. UI 布局设计

### 4.1 整体结构

```
┌──────────────────────────────────────────────────────────────────────┐
│  ╔════════════════════════════════════════════════════════════════╗  │
│  ║                      设置 (Settings)                      [×]  ║  │
│  ╠════════════════════════════════════════════════════════════════╣  │
│  ║  ┌──────────────┐  ┌────────────────────────────────────────┐  ║  │
│  ║  │              │  │                                        │  ║  │
│  ║  │   📍 通用     │  │   [分类标题]                           │  ║  │
│  ║  │   🤖 模型     │  │                                        │  ║  │
│  ║  │   🛡️ 审批    │  │   ┌─────────────────────────────────┐  │  ║  │
│  ║  │   🌐 远程服务器│  │   │  设置项标签                     │  │  ║  │
│  ║  │   ⌨️ 快捷键   │  │   │  [输入控件/选择器]               │  │  ║  │
│  ║  │   🔧 高级     │  │   │  设置项帮助说明文字              │  │  ║  │
│  ║  │              │  │   └─────────────────────────────────┘  │  ║  │
│  ║  │              │  │                                        │  ║  │
│  ║  │              │  │   ┌─────────────────────────────────┐  │  ║  │
│  ║  │              │  │   │  设置项标签                     │  │  ║  │
│  ║  │              │  │   │  [输入控件/选择器]               │  │  ║  │
│  ║  │              │  │   │  设置项帮助说明文字              │  │  ║  │
│  ║  │              │  │   └─────────────────────────────────┘  │  ║  │
│  ║  │              │  │                                        │  ║  │
│  ║  └──────────────┘  └────────────────────────────────────────┘  ║  │
│  ╚════════════════════════════════════════════════════════════════╝  │
│                         (毛玻璃遮罩背景)                             │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 设置项卡片结构

```
┌─────────────────────────────────────────────────────────────────┐
│  主题                                                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ○ 浅色模式    ● 深色模式    ○ 跟随系统                     ││
│  └─────────────────────────────────────────────────────────────┘│
│  根据您的偏好自定义应用外观                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 开关设置项

```
┌─────────────────────────────────────────────────────────────────┐
│  需要审批文件写入                                       [━━●]   │
│  开启后，AI 写入文件前需要您的确认                               │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 列表管理设置项

```
┌─────────────────────────────────────────────────────────────────┐
│  信任的命令列表                                    [+ 添加命令]  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │  git status                                   [×]   │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │  npm install                                  [×]   │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │  cargo build                                  [×]   │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│  这些命令将自动获得批准执行                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. CSS 样式规范

### 5.1 颜色方案

```css
/* 设置面板使用项目统一的 CSS 变量 */

/* 背景色 */
--settings-bg: var(--color-bg);
--settings-nav-bg: var(--color-bg-secondary);
--settings-content-bg: var(--color-bg);
--settings-item-bg: var(--color-bg-subtle);

/* 文字颜色 */
--settings-text: var(--color-text);
--settings-text-secondary: var(--color-text-secondary);
--settings-text-muted: var(--color-text-secondary);

/* 边框 */
--settings-border: var(--color-border);
--settings-border-hover: var(--color-border-hover);

/* 强调色 */
--settings-accent: var(--color-primary);
--settings-accent-hover: var(--color-primary-hover);
```

### 5.2 圆角规范

| 元素 | 圆角变量 | 值 |
|------|----------|-----|
| 模态整体 | `--radius-xl` | 24px |
| 导航区域 | `--radius-lg` | 18px |
| 设置项卡片 | `--radius-md` | 12px |
| 输入框/按钮 | `--radius-sm` | 6px |
| 开关组件 | `--radius-full` | 9999px |

### 5.3 间距规范

| 元素 | 间距变量 | 值 |
|------|----------|-----|
| 模态内边距 | `--spacing-xl` | 24px |
| 分类间距 | `--spacing-lg` | 16px |
| 设置项间距 | `--spacing-md` | 12px |
| 内部元素间距 | `--spacing-sm` | 8px |
| 紧凑间距 | `--spacing-xs` | 4px |

### 5.4 阴影效果

```css
/* 模态窗口阴影 */
.settings-modal {
  box-shadow: var(--shadow-xl);
}

/* 设置项悬停效果 */
.settings-item:hover {
  box-shadow: var(--shadow-sm);
}

/* 导航项选中效果 */
.settings-nav-item--active {
  box-shadow: var(--shadow-md);
}
```

---

## 6. 组件结构

### 6.1 组件树

```
SettingsModal/
├── SettingsModal.tsx          # 主模态组件
├── SettingsModal.css          # 样式文件
├── components/
│   ├── SettingsNav.tsx        # 左侧导航组件
│   ├── SettingsContent.tsx    # 右侧内容区域
│   ├── SettingSection.tsx     # 设置分类区块
│   └── SettingItem.tsx        # 单个设置项
├── sections/
│   ├── GeneralSettings.tsx    # 通用设置
│   ├── ModelSettings.tsx      # 模型设置
│   ├── ApprovalSettings.tsx   # 审批策略设置
│   ├── RemoteSettings.tsx     # 远程服务器设置
│   ├── ShortcutSettings.tsx   # 快捷键设置
│   └── AdvancedSettings.tsx   # 高级设置
├── hooks/
│   └── useSettings.ts         # 设置状态管理
└── types/
    └── settings.ts            # 类型定义
```

### 6.2 核心组件 Props

#### SettingsModal

```typescript
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
  initialSection?: SettingsSection;
}

type SettingsSection = 
  | 'general'
  | 'model'
  | 'approval'
  | 'remote'
  | 'shortcuts'
  | 'advanced';
```

#### SettingItem

```typescript
interface SettingItemProps {
  id: string;
  label: string;
  description?: string;
  children: React.ReactNode;  // 输入控件
  error?: string;
  required?: boolean;
}
```

#### SettingSection

```typescript
interface SettingSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}
```

---

## 7. 数据持久化

### 7.1 存储方案

使用 Tauri 的文件系统 API 进行设置存储：

```typescript
// 存储路径: ~/.codex-desktop/settings.json
interface SettingsStorage {
  general: GeneralSettings;
  model: ModelSettings;
  approval: ApprovalSettings;
  shortcuts: ShortcutSettings;
  advanced: AdvancedSettings;
  // 版本号用于迁移
  version: number;
}
```

### 7.2 设置同步

```typescript
// 通过 Tauri commands 与后端同步
invoke('get_settings')     // 获取所有设置
invoke('update_settings', { settings })  // 更新设置
invoke('reset_settings')   // 重置为默认值
```

---

## 8. 交互细节

### 8.1 打开方式

- 侧边栏底部设置图标点击
- 键盘快捷键: `Cmd/Ctrl + ,`
- 菜单栏: 设置 > 偏好设置

### 8.2 关闭方式

- 点击右上角关闭按钮 (×)
- 按 Escape 键
- 点击遮罩层

### 8.3 保存机制

- **即时保存**: 开关、选择器等控件变更即时生效
- **确认保存**: 文本输入等需要用户确认的设置项
- **状态指示**: 右上角显示保存状态（已保存 / 保存中...）

### 8.4 动画效果

```css
/* 模态打开动画 */
.settings-modal-enter {
  opacity: 0;
  transform: scale(0.95);
}

.settings-modal-enter-active {
  opacity: 1;
  transform: scale(1);
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}

/* 导航项切换 */
.settings-nav-item {
  transition: background-color 0.15s ease, color 0.15s ease;
}

/* 设置项悬停 */
.settings-item {
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
```

---

## 9. 可访问性 (Accessibility)

### 9.1 键盘导航

- Tab 键在设置项间切换焦点
- 方向键在导航分类间移动
- Enter 键激活当前焦点元素
- Escape 键关闭模态

### 9.2 ARIA 属性

```tsx
<dialog 
  role="dialog" 
  aria-modal="true" 
  aria-labelledby="settings-title"
>
  <h1 id="settings-title">设置</h1>
  <nav role="navigation" aria-label="设置分类">
    ...
  </nav>
  <main role="main" aria-label="设置内容">
    ...
  </main>
</dialog>
```

### 9.3 焦点管理

- 打开模态时，焦点移至第一个可交互元素
- 关闭模态时，焦点返回触发元素
- 焦点限制在模态内部（focus trap）

---

## 10. 国际化 (i18n)

### 10.1 翻译键结构

```json
{
  "settings": {
    "title": "设置",
    "sections": {
      "general": "通用",
      "model": "模型",
      "approval": "审批策略",
      "remote": "远程服务器",
      "shortcuts": "快捷键",
      "advanced": "高级"
    },
    "general": {
      "language": "语言",
      "languageDescription": "选择界面显示语言",
      "theme": "主题",
      "themeDescription": "根据您的偏好自定义应用外观",
      "themeLight": "浅色",
      "themeDark": "深色",
      "themeSystem": "跟随系统"
    }
    // ... 其他翻译键
  }
}
```

---

## 11. 后续扩展

### 11.1 计划中的功能

- [ ] 设置搜索功能
- [ ] 设置导入/导出
- [ ] 设置云同步
- [ ] 自定义主题编辑器
- [ ] MCP 服务器配置管理
- [ ] 插件/扩展管理

### 11.2 扩展点设计

```typescript
// 允许注册自定义设置区块
interface SettingsExtensionPoint {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ComponentType;
  order: number;
}
```

---

## 12. 实现优先级

### Phase 1 - MVP (核心功能)
1. 模态框架和导航切换
2. 通用设置（语言、主题）
3. 模型设置（API 配置）
4. 基础持久化

### Phase 2 - 完善功能
1. 审批策略设置
2. 远程服务器集成（复用现有组件）
3. 快捷键自定义
4. 设置搜索

### Phase 3 - 高级功能
1. 高级设置
2. 数据导入/导出
3. 云同步准备
4. 插件管理预留

---

## 附录: 参考样式截图说明

基于现有应用截图分析，设置面板应遵循以下视觉特征：

1. **卡片式设计**: 与 Sidebar 和 ChatContainer 一致的卡片风格
2. **柔和圆角**: 使用 18-24px 的大圆角
3. **层次感**: 通过阴影和背景色区分层次
4. **品牌色**: 使用 `#74aa9c` 作为强调色
5. **字体**: Inter 字体，保持与现有 UI 一致
6. **图标**: 使用与侧边栏一致的图标风格
