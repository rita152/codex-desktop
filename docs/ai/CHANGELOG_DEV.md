# 开发变更日志

---

## 2026-01-30

### [FEATURE] Phase 1: 冷启动优化实施

**变更类型**: feature
**影响范围**: 前端 + 后端

#### 变更文件

| 文件 | 修改内容 |
|------|----------|
| `src/hooks/useCodexEffects.ts` | 添加预热逻辑，复用 warmup session |
| `src/hooks/useCodexReadyState.ts` | 新增，提供 Codex 就绪状态 hook |
| `src/api/codex.ts` | 添加 `warmupCodex()` API |
| `src-tauri/src/codex/service.rs` | 添加 `Warmup` 命令和处理 |
| `src-tauri/src/codex/commands.rs` | 添加 `codex_warmup` Tauri 命令 |
| `src-tauri/src/lib.rs` | 注册 `codex_warmup` 命令 |

#### 变更内容

1. **预热机制**:
   - App 启动后 500ms 自动调用 `warmupCodex()` 预热 ACP 连接
   - 预热期间创建 warmup session 获取 mode/model 选项
   - 首次 `ensureCodexSession` 调用会复用 warmup session

2. **后端 Warmup 命令**:
   - 新增 `ServiceCommand::Warmup` 确保连接建立和初始化
   - 添加 debug 事件 `warmup_start` / `warmup_end` 用于性能追踪

3. **就绪状态 Hook**:
   - `useCodexReadyState()`: 返回 `'initializing' | 'warming' | 'ready'`
   - `useIsCodexReady()`: 返回是否可以接受用户输入

#### 预期收益

- 首次响应时间从 ~5-9s 降至 ~1-2s
- 用户无需等待即可开始输入（warmup 在后台进行）

#### 测试要点

- [ ] App 启动后 500ms 观察 debug 日志是否有 warmup 事件
- [ ] 首次发送消息验证是否复用 warmup session（日志 "reusing warmup session"）
- [ ] 测量首次响应延迟是否改善
- [ ] 预热失败时功能不受影响（正常创建新 session）

#### 回滚要点

1. 移除 `useCodexEffects.ts` 中的预热相关代码
2. 移除 `warmupResultRef` 和 warmup session 复用逻辑
3. 移除 `useCodexReadyState.ts` 文件
4. 移除后端 `Warmup` 命令及相关代码
5. 从 `lib.rs` 移除 `codex_warmup` 注册

#### 下一步

- 验证 Phase 1 效果
- 准备 Phase 2: 响应可靠性（超时 + 取消）

---

### [ANALYSIS] Prompt 执行链路阻塞分析

**变更类型**: 分析文档
**影响范围**: 无代码变更

#### 变更内容

1. 完成 Prompt 执行链路全流程分析
2. 识别 10 个潜在阻塞点：
   - ① mpsc channel 发送（低风险）
   - ② oneshot channel 等待响应（**高风险**）
   - ③ Worker Loop 串行处理（中风险）
   - ④ 首次初始化（**高风险，仅首次**）
   - ⑤ 进程启动（中风险，仅首次）
   - ⑥ ACP Protocol prompt（高风险，已缓解）
   - ⑦ LLM API（外部，不可控）
   - ⑧ Tauri Event Emit（低风险）
   - ⑨ 前端消息处理（中风险）
   - ⑩ React 重渲染（中风险）
3. 延迟估算：
   - 首次响应: 5-9s
   - 后续响应: 130-530ms
4. 制定 4 阶段优化计划

#### 产出文档

- `docs/ai/PROMPT_PIPELINE_OPTIMIZATION.md` - 完整优化方案
- `docs/ai/PROJECT_SNAPSHOT.md` - 项目快照更新
- `docs/ai/TODO_NOW.md` - 任务清单
- `docs/ai/CHANGELOG_DEV.md` - 本文件

#### 下一步

- 实施 Phase 1: 冷启动优化
- 预期收益: 首次响应从 5-9s 降至 1-2s

---

## 模板

```markdown
## YYYY-MM-DD

### [TYPE] 变更标题

**变更类型**: feature | bugfix | refactor | analysis | docs
**影响范围**: 模块/文件列表
**关联 Issue/PR**: #xxx

#### 变更内容

1. 变更点 1
2. 变更点 2

#### 测试要点

- [ ] 测试项 1
- [ ] 测试项 2

#### 回滚要点

1. 回滚步骤 1
2. 回滚步骤 2

#### 下一步

- 后续任务
```
