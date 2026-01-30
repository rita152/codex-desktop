# 开发变更日志

本文件记录项目的实质性变更，用于追踪进度和回滚参考。

---

## 2026-01-30

### 完成阶段 0：迁移准备工作

**变更点**:
- 为四个 Store 添加 devtools 中间件（开发模式启用）
- 完善 `src/stores/index.ts` 类型导出和文档注释
- 创建测试工具文件 `src/stores/testUtils.ts`
- 创建 Store 单元测试（40 个测试用例全部通过）

**影响面**:
- `src/stores/uiStore.ts` - 添加 devtools
- `src/stores/sessionStore.ts` - 添加 devtools
- `src/stores/codexStore.ts` - 添加 devtools
- `src/stores/settingsStore.ts` - 添加 devtools
- `src/stores/index.ts` - 增强导出
- `src/stores/testUtils.ts` - 新文件
- `src/stores/*.test.ts` - 新测试文件

**测试点**:
- `npm run test:unit -- src/stores/*.test.ts` - 40 测试全部通过

**回滚要点**:
- 撤销 devtools 中间件添加
- 删除测试文件和 testUtils.ts

---

### 创建 Context → Store 迁移计划

**变更点**:
- 创建 `docs/ai/` 目录及标准文件
- 创建迁移计划文档 `MIGRATION_CONTEXT_TO_STORE.md`

**影响面**:
- 文档变更，无代码影响

**测试点**:
- N/A

**回滚要点**:
- 删除 `docs/ai/` 目录即可

---

## 模板

```markdown
## YYYY-MM-DD

### 变更标题

**变更点**:
- 具体改动 1
- 具体改动 2

**影响面**:
- 模块/接口/数据结构影响

**测试点**:
- 需要验证的功能点

**回滚要点**:
- 如何回滚此变更
```
