# 当前任务清单

**更新日期**: 2026-01-30

---

## 正在进行

### [OPT-001] Prompt 执行链路优化

**状态**: 🟢 Phase 1 完成，待验证
**优先级**: P0
**文档**: [PROMPT_PIPELINE_OPTIMIZATION.md](./PROMPT_PIPELINE_OPTIMIZATION.md)

#### Phase 1 完成情况 ✅

- [x] **Phase 1.1**: 实现 App 启动预热机制
- [x] **Phase 1.2**: 添加 `codex_warmup` 命令
- [x] **Phase 1.3**: 创建 `useCodexReadyState` hook

#### 下一步行动

- [ ] **验证**: 测试 Phase 1 效果，确认首次响应改善
- [ ] **Phase 2.1**: 添加 prompt 超时机制
  - 文件: `src-tauri/src/codex/service.rs`
  - 工作量: 2h
- [ ] **Phase 2.2**: 实现用户可取消功能
  - 工作量: 4h

---

## 待开始

### [MIG-001] Context → Store 迁移

**状态**: ⚪ 待继续
**优先级**: P1
**文档**: [MIGRATION_CONTEXT_TO_STORE.md](./MIGRATION_CONTEXT_TO_STORE.md)

#### 剩余工作

- [ ] 移除废弃的 Context 代码
- [ ] 更新组件引用

---

## 已完成

### [OPT-001-P1] Phase 1: 冷启动优化

**状态**: ✅ 完成
**完成日期**: 2026-01-30

#### 成果

- 实现 App 启动后 500ms 预热机制
- 添加 `codex_warmup` 后端命令
- 首次 `ensureCodexSession` 复用 warmup session
- 创建 `useCodexReadyState` hook

#### 预期收益

- 首次响应: 5-9s → 1-2s

---

### [ANALYSIS-001] Prompt 执行链路阻塞分析

**状态**: ✅ 完成
**完成日期**: 2026-01-30

#### 成果

- 识别 10 个潜在阻塞点
- 完成延迟分析（首次 5-9s，后续 130-530ms）
- 制定 4 阶段优化计划
- 产出完整优化文档

---

## 阻塞项

无

---

## 决策待定

### [DEC-001] Chunk 合并策略

**问题**: 是否需要在 Rust 端还是 JS 端实现 chunk 合并？

**选项**:
- A: Rust 端 - 减少 IPC 开销，但增加复杂度
- B: JS 端 - 实现简单，但 IPC 次数不减少

**倾向**: B（JS 端），因为 IPC 开销不是主要瓶颈

**等待**: 性能测试数据
