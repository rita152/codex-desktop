import { useState, useCallback, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

import { ChatContainer } from './components/business/ChatContainer';
import { approveRequest, createSession, initCodex, sendPrompt } from './api/codex';
import { useSessionPersistence } from './hooks/useSessionPersistence';

import type { Message } from './components/business/ChatMessageList/types';
import type { ChatSession } from './components/business/Sidebar/types';
import type {
  ToolCallContent,
  ToolCallLocation,
  ToolCallProps,
  ToolCallStatus,
  ToolKind,
  TerminalContent,
} from './components/ui/feedback/ToolCall';
import type {
  ApprovalDiff,
  ApprovalProps,
  PermissionOption as ApprovalOption,
  PermissionOptionKind,
} from './components/ui/feedback/Approval';
import type { ApprovalRequest, PermissionOption } from './types/codex';
import { buildUnifiedDiff } from './utils/diff';

import './App.css';

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function newMessageId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const RECOVERY_CONTEXT_LIMIT = 12;
const RECOVERY_CHAR_LIMIT = 1800;
const RECOVERY_NOTICE =
  '系统提示：此会话已从本地恢复，继续对话会创建新的 Codex 会话，并注入最近上下文。';

function buildRecoveryPrompt(history: Message[], content: string): string {
  const contextLines = history
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => {
      const role = message.role === 'user' ? 'User' : 'Assistant';
      return `${role}: ${message.content}`;
    })
    .filter((line) => line.trim() !== '')
    .slice(-RECOVERY_CONTEXT_LIMIT);

  if (contextLines.length === 0) return content;

  let context = contextLines.join('\n');
  if (context.length > RECOVERY_CHAR_LIMIT) {
    context = context.slice(context.length - RECOVERY_CHAR_LIMIT);
  }

  return `Restored session context (read-only):\n${context}\n\nUser message:\n${content}`;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object') return null;
  return value as UnknownRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function findLastIndex<T>(list: T[], predicate: (item: T) => boolean): number {
  for (let i = list.length - 1; i >= 0; i--) {
    if (predicate(list[i])) return i;
  }
  return -1;
}

function normalizeToolCallStatus(value: unknown): ToolCallStatus {
  const key = String(value ?? '').toLowerCase();
  switch (key) {
    case 'in_progress':
    case 'in-progress':
      return 'in-progress';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

function normalizeToolKind(value: unknown): ToolKind | undefined {
  const key = String(value ?? '').toLowerCase();
  switch (key) {
    case 'read':
      return 'read';
    case 'edit':
    case 'delete':
    case 'move':
      return 'edit';
    case 'execute':
      return 'execute';
    case 'search':
      return 'search';
    case 'fetch':
      return 'fetch';
    case 'browser':
      return 'browser';
    case 'mcp':
      return 'mcp';
    default:
      return key ? 'other' : undefined;
  }
}

function normalizePermissionKind(value: unknown): PermissionOptionKind {
  const key = String(value ?? '').toLowerCase();
  switch (key) {
    case 'allow_always':
    case 'allow-always':
      return 'allow-always';
    case 'allow_once':
    case 'allow-once':
      return 'allow-once';
    case 'reject_always':
    case 'reject-always':
      return 'reject-always';
    case 'reject_once':
    case 'reject-once':
    case 'abort':
      return 'reject-once';
    default:
      return 'allow-once';
  }
}

function extractMeta(raw: UnknownRecord | null): UnknownRecord | null {
  if (!raw) return null;
  return (asRecord(raw._meta) ?? asRecord(raw.meta)) ?? null;
}

function parseToolCallLocations(raw: unknown): ToolCallLocation[] | undefined {
  const items = asArray(raw);
  if (items.length === 0) return undefined;
  const locations = items
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      const path = getString(record.path ?? record.uri);
      if (!path) return null;
      const line = getNumber(record.line ?? record.startLine ?? record.start_line);
      return {
        uri: path,
        range: line ? { startLine: line } : undefined,
      };
    })
    .filter(Boolean) as ToolCallLocation[];

  return locations.length > 0 ? locations : undefined;
}

function parseToolCallContent(raw: unknown): ToolCallContent[] | null {
  const items = asArray(raw);
  if (items.length === 0) return null;
  const result: ToolCallContent[] = [];

  for (const item of items) {
    const record = asRecord(item);
    if (!record) continue;
    const type = getString(record.type);

    if (type === 'content') {
      const contentRecord = asRecord(record.content);
      if (!contentRecord) continue;
      const contentType = getString(contentRecord.type);
      if (contentType === 'text' && typeof contentRecord.text === 'string') {
        result.push({ type: 'text', text: contentRecord.text });
      } else if (contentType === 'resource_link') {
        const name = getString(contentRecord.name) ?? 'resource';
        const uri = getString(contentRecord.uri);
        result.push({
          type: 'text',
          text: uri ? `${name} (${uri})` : name,
        });
      } else {
        result.push({
          type: 'text',
          text: safeJson(contentRecord),
        });
      }
      continue;
    }

    if (type === 'diff') {
      const path = getString(record.path) ?? 'unknown';
      const oldText =
        typeof record.oldText === 'string'
          ? record.oldText
          : typeof record.old_text === 'string'
            ? record.old_text
            : null;
      const newText =
        typeof record.newText === 'string'
          ? record.newText
          : typeof record.new_text === 'string'
            ? record.new_text
            : '';
      result.push({
        type: 'diff',
        path,
        diff: buildUnifiedDiff(path, oldText, newText),
      });
      continue;
    }

    if (type === 'terminal') {
      const terminalId = getString(record.terminalId ?? record.terminal_id);
      if (terminalId) {
        result.push({ type: 'terminal', terminalId });
      }
    }
  }

  return result.length > 0 ? result : null;
}

function applyTerminalMeta(
  content: ToolCallContent[] | undefined,
  meta: UnknownRecord | null
): ToolCallContent[] | undefined {
  if (!meta) return content;
  let nextContent = content ? [...content] : [];

  const ensureTerminalContent = (terminalId: string): TerminalContent => {
    const index = nextContent.findIndex(
      (item) => item.type === 'terminal' && item.terminalId === terminalId
    );
    if (index >= 0) {
      return nextContent[index] as TerminalContent;
    }
    const created: TerminalContent = { type: 'terminal', terminalId, output: '' };
    nextContent = [...nextContent, created];
    return created;
  };

  const terminalInfo = asRecord(meta.terminal_info ?? meta.terminalInfo);
  const terminalOutput = asRecord(meta.terminal_output ?? meta.terminalOutput);
  const terminalExit = asRecord(meta.terminal_exit ?? meta.terminalExit);

  if (terminalInfo) {
    const terminalId = getString(terminalInfo.terminal_id ?? terminalInfo.terminalId);
    if (terminalId) {
      const entry = ensureTerminalContent(terminalId);
      const cwd = getString(terminalInfo.cwd);
      const nextEntry = { ...entry, cwd };
      nextContent = nextContent.map((item) =>
        item.type === 'terminal' && item.terminalId === terminalId ? nextEntry : item
      );
    }
  }

  if (terminalOutput) {
    const terminalId = getString(terminalOutput.terminal_id ?? terminalOutput.terminalId);
    const data = getString(terminalOutput.data);
    if (terminalId && data !== undefined) {
      const entry = ensureTerminalContent(terminalId);
      const nextEntry = {
        ...entry,
        output: `${entry.output ?? ''}${data}`,
      };
      nextContent = nextContent.map((item) =>
        item.type === 'terminal' && item.terminalId === terminalId ? nextEntry : item
      );
    }
  }

  if (terminalExit) {
    const terminalId = getString(terminalExit.terminal_id ?? terminalExit.terminalId);
    if (terminalId) {
      const entry = ensureTerminalContent(terminalId);
      const nextEntry = {
        ...entry,
        exitCode: getNumber(terminalExit.exit_code ?? terminalExit.exitCode) ?? entry.exitCode,
        signal: getString(terminalExit.signal) ?? entry.signal,
      };
      nextContent = nextContent.map((item) =>
        item.type === 'terminal' && item.terminalId === terminalId ? nextEntry : item
      );
    }
  }

  return nextContent.length > 0 ? nextContent : content;
}

function getToolCallId(raw: UnknownRecord): string {
  const id = getString(raw.toolCallId ?? raw.tool_call_id ?? raw.id);
  return id ?? '';
}

function parseToolCall(raw: UnknownRecord): ToolCallProps {
  const meta = extractMeta(raw);
  const toolCallId = getToolCallId(raw) || newMessageId();
  const title = getString(raw.title ?? raw.name) ?? 'Tool Call';
  const status = normalizeToolCallStatus(raw.status);
  const kind = normalizeToolKind(raw.kind);
  const locations = parseToolCallLocations(raw.locations);
  const rawInput = raw.rawInput ?? raw.raw_input;
  const rawOutput = raw.rawOutput ?? raw.raw_output;
  const parsedContent = parseToolCallContent(raw.content);
  const content = applyTerminalMeta(parsedContent ?? undefined, meta);

  return {
    toolCallId,
    title,
    kind,
    status,
    content,
    locations,
    rawInput,
    rawOutput,
    startTime: status === 'in-progress' ? Date.now() : undefined,
  };
}

function applyToolCallUpdate(
  existing: ToolCallProps | undefined,
  raw: UnknownRecord
): ToolCallProps {
  const meta = extractMeta(raw);
  const toolCallId = getToolCallId(raw) || existing?.toolCallId || newMessageId();
  const status = raw.status ? normalizeToolCallStatus(raw.status) : existing?.status ?? 'pending';
  const kind = normalizeToolKind(raw.kind ?? existing?.kind);
  const title = getString(raw.title) ?? existing?.title ?? 'Tool Call';
  const locations = raw.locations ? parseToolCallLocations(raw.locations) : existing?.locations;
  const rawInput = raw.rawInput ?? raw.raw_input ?? existing?.rawInput;
  const rawOutput = raw.rawOutput ?? raw.raw_output ?? existing?.rawOutput;

  const parsedContent = parseToolCallContent(raw.content);
  const mergedContent = applyTerminalMeta(parsedContent ?? existing?.content, meta);

  const startTime =
    existing?.startTime ?? (status === 'in-progress' ? Date.now() : undefined);
  const duration =
    (status === 'completed' || status === 'failed') && startTime
      ? existing?.duration ?? (Date.now() - startTime) / 1000
      : existing?.duration;

  return {
    toolCallId,
    title,
    kind,
    status,
    content: mergedContent,
    locations,
    rawInput,
    rawOutput,
    startTime,
    duration,
  };
}

function closeActiveThoughtMessages(list: Message[], now: number): Message[] {
  const lastThoughtIdx = findLastIndex(
    list,
    (message) => message.role === 'thought' && message.isStreaming
  );
  if (lastThoughtIdx === -1) return list;

  const message = list[lastThoughtIdx];
  const startTime = message.thinking?.startTime;
  const duration =
    startTime !== undefined ? (now - startTime) / 1000 : message.thinking?.duration;
  const content = message.thinking?.content ?? message.content;
  const nextMessage: Message = {
    ...message,
    isStreaming: false,
    thinking: {
      content,
      phase: 'done',
      isStreaming: false,
      startTime,
      duration,
    },
    timestamp: message.timestamp ?? new Date(now),
  };

  const nextList = [...list];
  nextList[lastThoughtIdx] = nextMessage;
  return nextList;
}

function closeActiveAssistantMessages(list: Message[], now: number): Message[] {
  const lastAssistantIdx = findLastIndex(
    list,
    (message) => message.role === 'assistant' && message.isStreaming
  );
  if (lastAssistantIdx === -1) return list;

  const message = list[lastAssistantIdx];
  const startTime = message.thinking?.startTime;
  const duration =
    startTime !== undefined ? (now - startTime) / 1000 : message.thinking?.duration;
  const nextMessage: Message = {
    ...message,
    isStreaming: false,
    thinking: message.thinking
      ? {
          ...message.thinking,
          phase: 'done',
          isStreaming: false,
          duration,
        }
      : undefined,
    timestamp: message.timestamp ?? new Date(now),
  };

  const nextList = [...list];
  nextList[lastAssistantIdx] = nextMessage;
  return nextList;
}

function extractCommand(rawInput: unknown): string | undefined {
  const record = asRecord(rawInput);
  if (!record) return undefined;
  const command = record.proposed_execpolicy_amendment ?? record.command ?? record.cmd;
  if (Array.isArray(command)) {
    return command.map((item) => String(item)).join(' ');
  }
  if (typeof command === 'string') return command;
  const parsedCmd = asArray(record.parsed_cmd)[0];
  const parsedRecord = asRecord(parsedCmd);
  const parsedText = parsedRecord && getString(parsedRecord.cmd);
  return parsedText ?? undefined;
}

function mapApprovalOptions(options: PermissionOption[] | undefined): ApprovalOption[] {
  if (!options) return [];
  return options
    .map((option) => {
      const id = getString(option.optionId ?? option.option_id ?? option.id);
      if (!id) return null;
      const label = getString(option.label ?? option.name) ?? id;
      return {
        id,
        label,
        kind: normalizePermissionKind(option.kind),
      };
    })
    .filter(Boolean) as ApprovalOption[];
}

function extractApprovalDiffs(toolCall: UnknownRecord): ApprovalDiff[] {
  const content = parseToolCallContent(toolCall.content);
  if (!content) return [];
  return content
    .filter((item) => item.type === 'diff')
    .map((item) => ({
      path: item.path,
      diff: item.diff,
    }));
}

function extractApprovalDescription(toolCall: UnknownRecord): string | undefined {
  const content = parseToolCallContent(toolCall.content);
  if (!content) return undefined;
  const texts = content
    .filter((item) => item.type === 'text')
    .map((item) => item.text.trim())
    .filter(Boolean);
  return texts.length > 0 ? texts.join('\n\n') : undefined;
}

function App() {
  const {
    sessions,
    setSessions,
    selectedSessionId,
    setSelectedSessionId,
    sessionMessages,
    setSessionMessages,
    restoredSessionIds,
    clearRestoredSession,
  } = useSessionPersistence();

  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalFeedback, setApprovalFeedback] = useState<Record<string, string>>({});
  const [approvalLoading, setApprovalLoading] = useState<Record<string, boolean>>({});

  const activeSessionIdRef = useRef<string>(selectedSessionId);
  const codexSessionByChatRef = useRef<Record<string, string>>({});
  const chatSessionByCodexRef = useRef<Record<string, string>>({});

  useEffect(() => {
    activeSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  // 当前会话的消息
  const messages = sessionMessages[selectedSessionId] ?? [];
  const isRestoredSession = restoredSessionIds.has(selectedSessionId);
  const inputPlaceholder = isRestoredSession
    ? '历史会话已恢复，发送新消息将创建新的会话'
    : undefined;

  const resolveChatSessionId = useCallback((codexSessionId?: string): string | null => {
    if (!codexSessionId) return null;
    return chatSessionByCodexRef.current[codexSessionId] ?? null;
  }, []);

  useEffect(() => {
    void initCodex().catch((err) => {
      console.warn('[codex] init failed', err);
    });
  }, []);

  useEffect(() => {
    const appendThoughtChunk = (sessionId: string, text: string) => {
      console.debug('[appendThoughtChunk]', {
        sessionId,
        textLen: text.length,
        text: text.slice(0, 50),
      });
      setSessionMessages((prev) => {
        const list = prev[sessionId] ?? [];
        const lastMessage = list[list.length - 1];
        const now = Date.now();

        if (!lastMessage || lastMessage.role !== 'thought' || !lastMessage.isStreaming) {
          const nextMessage: Message = {
            id: newMessageId(),
            role: 'thought',
            content: text,
            isStreaming: true,
            thinking: {
              content: text,
              phase: 'thinking',
              isStreaming: true,
              startTime: now,
            },
          };
          return { ...prev, [sessionId]: [...list, nextMessage] };
        }

        const current = lastMessage;
        const currentContent = current.thinking?.content ?? current.content;
        const nextContent = currentContent + text;
        const startTime = current.thinking?.startTime ?? now;
        const nextList = [...list];
        nextList[nextList.length - 1] = {
          ...current,
          content: nextContent,
          isStreaming: true,
          thinking: {
            content: nextContent,
            phase: 'thinking',
            isStreaming: true,
            startTime,
            duration: current.thinking?.duration,
          },
        };
        return { ...prev, [sessionId]: nextList };
      });
    };

    const appendAssistantChunk = (sessionId: string, text: string) => {
      console.debug('[appendAssistantChunk]', { sessionId, textLen: text.length });
      setSessionMessages((prev) => {
        const baseList = prev[sessionId] ?? [];
        const list = closeActiveThoughtMessages(baseList, Date.now());
        const lastMessage = list[list.length - 1];
        if (lastMessage?.role === 'assistant' && lastMessage.isStreaming) {
          const nextList = [...list];
          nextList[nextList.length - 1] = {
            ...lastMessage,
            content: lastMessage.content + text,
            isStreaming: true,
          };
          return { ...prev, [sessionId]: nextList };
        }

        const nextMessage: Message = {
          id: newMessageId(),
          role: 'assistant',
          content: text,
          isStreaming: true,
        };
        return { ...prev, [sessionId]: [...list, nextMessage] };
      });
    };

    const upsertToolCallMessage = (sessionId: string, toolCall: ToolCallProps) => {
      const isStreaming =
        toolCall.status === 'in-progress' || toolCall.status === 'pending';

      setSessionMessages((prev) => {
        const list = prev[sessionId] ?? [];
        let updated = false;
        const nextList = list.map((msg) => {
          if (!msg.toolCalls) return msg;
          const index = msg.toolCalls.findIndex(
            (call) => call.toolCallId === toolCall.toolCallId
          );
          if (index === -1) return msg;
          updated = true;
          const nextCalls = [...msg.toolCalls];
          nextCalls[index] = toolCall;
          return {
            ...msg,
            toolCalls: nextCalls,
            isStreaming,
            timestamp: msg.timestamp ?? (isStreaming ? undefined : new Date()),
          };
        });

        if (!updated) {
          const now = Date.now();
          const nextListWithThoughts = closeActiveThoughtMessages(list, now);
          const nextListWithAssistant = closeActiveAssistantMessages(nextListWithThoughts, now);
          const nextMessage: Message = {
            id: toolCall.toolCallId,
            role: 'tool',
            content: '',
            toolCalls: [toolCall],
            isStreaming,
            timestamp: isStreaming ? undefined : new Date(),
          };
          return { ...prev, [sessionId]: [...nextListWithAssistant, nextMessage] };
        }

        return { ...prev, [sessionId]: nextList };
      });
    };

    const applyToolCallUpdateMessage = (sessionId: string, update: UnknownRecord) => {
      const toolCallId = getToolCallId(update);
      if (!toolCallId) return;

      setSessionMessages((prev) => {
        const list = prev[sessionId] ?? [];
        let updated = false;
        const nextList = list.map((msg) => {
          if (!msg.toolCalls) return msg;
          const index = msg.toolCalls.findIndex((call) => call.toolCallId === toolCallId);
          if (index === -1) return msg;
          updated = true;
          const nextCall = applyToolCallUpdate(msg.toolCalls[index], update);
          const isStreaming =
            nextCall.status === 'in-progress' || nextCall.status === 'pending';
          const nextCalls = [...msg.toolCalls];
          nextCalls[index] = nextCall;
          return {
            ...msg,
            toolCalls: nextCalls,
            isStreaming,
            timestamp: msg.timestamp ?? (isStreaming ? undefined : new Date()),
          };
        });

        if (!updated) {
          const nextCall = applyToolCallUpdate(undefined, update);
          const isStreaming =
            nextCall.status === 'in-progress' || nextCall.status === 'pending';
          const now = Date.now();
          const nextListWithThoughts = closeActiveThoughtMessages(list, now);
          const nextListWithAssistant = closeActiveAssistantMessages(nextListWithThoughts, now);
          const nextMessage: Message = {
            id: nextCall.toolCallId,
            role: 'tool',
            content: '',
            toolCalls: [nextCall],
            isStreaming,
            timestamp: isStreaming ? undefined : new Date(),
          };
          return { ...prev, [sessionId]: [...nextListWithAssistant, nextMessage] };
        }

        return { ...prev, [sessionId]: nextList };
      });
    };

    const unlistenPromises = [
      listen<{ sessionId: string; text: string }>('codex:message', (event) => {
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        appendAssistantChunk(sessionId, event.payload.text);
      }),
      listen<{ sessionId: string; text: string }>('codex:thought', (event) => {
        console.debug('[codex:thought] Received', {
          sessionId: event.payload.sessionId,
          textLen: event.payload.text.length,
        });
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        appendThoughtChunk(sessionId, event.payload.text);
      }),
      listen<{ sessionId: string; stopReason: unknown }>('codex:turn-complete', (event) => {
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const nowMs = Date.now();
        const now = new Date(nowMs);
        setSessionMessages((prev) => {
          const list = prev[sessionId] ?? [];
          const next = list.map((m) => {
            if (m.role === 'user' || !m.isStreaming) return m;
            if (m.role === 'thought') {
              const startTime = m.thinking?.startTime;
              const duration =
                startTime !== undefined ? (nowMs - startTime) / 1000 : m.thinking?.duration;
              return {
                ...m,
                isStreaming: false,
                thinking: {
                  content: m.thinking?.content ?? m.content,
                  phase: 'done',
                  isStreaming: false,
                  startTime,
                  duration,
                },
                timestamp: m.timestamp ?? now,
              };
            }
            if (m.thinking) {
              const startTime = m.thinking.startTime;
              const duration =
                startTime !== undefined ? (nowMs - startTime) / 1000 : m.thinking.duration;
              return {
                ...m,
                isStreaming: false,
                thinking: {
                  ...m.thinking,
                  phase: 'done',
                  isStreaming: false,
                  duration,
                },
                timestamp: m.timestamp ?? now,
              };
            }
            return {
              ...m,
              isStreaming: false,
              timestamp: m.timestamp ?? now,
            };
          });
          return { ...prev, [sessionId]: next };
        });

        setIsGenerating(false);
      }),
      listen<{ error: string }>('codex:error', (event) => {
        const sessionId = activeSessionIdRef.current;
        const errMsg: Message = {
          id: newMessageId(),
          role: 'assistant',
          content: `发生错误：${event.payload.error}`,
          isStreaming: false,
          timestamp: new Date(),
        };

        setSessionMessages((prev) => ({
          ...prev,
          [sessionId]: [...(prev[sessionId] ?? []), errMsg],
        }));

        setIsGenerating(false);
      }),
      listen<ApprovalRequest>('codex:approval-request', (event) => {
        const req = event.payload;
        const key = `${req.sessionId}:${req.requestId}`;
        setPendingApprovals((prev) => {
          const next = prev.filter((item) => `${item.sessionId}:${item.requestId}` !== key);
          return [...next, req];
        });
        setApprovalFeedback((prev) => ({ ...prev, [key]: prev[key] ?? '' }));
        setApprovalLoading((prev) => ({ ...prev, [key]: false }));
      }),
      listen<{ sessionId: string; toolCall: unknown }>('codex:tool-call', (event) => {
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const toolCall = asRecord(event.payload.toolCall);
        if (!toolCall) return;
        const parsed = parseToolCall(toolCall);
        upsertToolCallMessage(sessionId, parsed);
      }),
      listen<{ sessionId: string; update: unknown }>('codex:tool-call-update', (event) => {
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const update = asRecord(event.payload.update);
        if (!update) return;
        applyToolCallUpdateMessage(sessionId, update);
      }),
    ];

    return () => {
      Promise.all(unlistenPromises)
        .then((unlisteners) => unlisteners.forEach((u) => u()))
        .catch(() => {});
    };
  }, [resolveChatSessionId]);

  const registerCodexSession = useCallback((chatSessionId: string, codexSessionId: string) => {
    codexSessionByChatRef.current[chatSessionId] = codexSessionId;
    chatSessionByCodexRef.current[codexSessionId] = chatSessionId;
  }, []);

  const clearCodexSession = useCallback((chatSessionId: string) => {
    const existing = codexSessionByChatRef.current[chatSessionId];
    if (existing) {
      delete chatSessionByCodexRef.current[existing];
    }
    delete codexSessionByChatRef.current[chatSessionId];
  }, []);

  const ensureCodexSession = useCallback(
    async (chatSessionId: string, forceNew: boolean) => {
      const existing = codexSessionByChatRef.current[chatSessionId];
      if (existing && !forceNew) return existing;

      if (existing) {
        delete chatSessionByCodexRef.current[existing];
      }

      const result = await createSession('.');
      registerCodexSession(chatSessionId, result.sessionId);
      if (forceNew) {
        clearRestoredSession(chatSessionId);
      }
      return result.sessionId;
    },
    [clearRestoredSession, registerCodexSession]
  );

  const handleNewChat = useCallback(() => {
    const newId = String(Date.now());
    const newSession: ChatSession = {
      id: newId,
      title: '新对话',
    };
    setSessions((prev) => [newSession, ...prev]);
    setSessionMessages((prev) => ({ ...prev, [newId]: [] }));
    setSelectedSessionId(newId);
    clearRestoredSession(newId);
    activeSessionIdRef.current = newId;
  }, [clearRestoredSession]);

  const handleSessionSelect = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
    activeSessionIdRef.current = sessionId;
  }, []);

  const handleSessionDelete = useCallback(
    (sessionId: string) => {
      // 不允许删除最后一个会话
      if (sessions.length <= 1) return;

      clearCodexSession(sessionId);
      clearRestoredSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setSessionMessages((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });

      // 如果删除的是当前选中的会话，切换到第一个会话
      if (sessionId === selectedSessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          setSelectedSessionId(remaining[0].id);
        }
      }
    },
    [clearCodexSession, clearRestoredSession, sessions, selectedSessionId]
  );

  const handleSessionRename = useCallback(
    (sessionId: string, newTitle: string) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
      );
    },
    []
  );

  const handleSendMessage = useCallback(
    (content: string) => {
      const now = Date.now();
      const sessionId = selectedSessionId;
      const shouldRecover = restoredSessionIds.has(sessionId);
      const userMessage: Message = {
        id: String(now),
        role: 'user',
        content,
        timestamp: new Date(),
      };
      const recoveryNotice: Message | null = shouldRecover
        ? {
            id: newMessageId(),
            role: 'assistant',
            content: RECOVERY_NOTICE,
            isStreaming: false,
            timestamp: new Date(),
          }
        : null;

      activeSessionIdRef.current = sessionId;
      setIsGenerating(true);

      // 更新当前会话的消息：添加用户消息（恢复会话时先追加提示）
      setSessionMessages((prev) => {
        const list = prev[sessionId] ?? [];
        const nextList = recoveryNotice
          ? [...list, recoveryNotice, userMessage]
          : [...list, userMessage];
        return { ...prev, [sessionId]: nextList };
      });

      // 如果是第一条消息，用消息内容更新会话标题
      if (messages.length === 0) {
        const title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
        );
      }

      void (async () => {
        try {
          const codexSessionId = await ensureCodexSession(sessionId, shouldRecover);
          const promptContent = shouldRecover ? buildRecoveryPrompt(messages, content) : content;
          await sendPrompt(codexSessionId, promptContent);
        } catch (err) {
          setSessionMessages((prev) => {
            const errMsg: Message = {
              id: newMessageId(),
              role: 'assistant',
              content: `调用失败：${String(err)}`,
              isStreaming: false,
              timestamp: new Date(),
            };
            return {
              ...prev,
              [sessionId]: [...(prev[sessionId] ?? []), errMsg],
            };
          });
          setIsGenerating(false);
        }
      })();
    },
    [
      ensureCodexSession,
      messages,
      restoredSessionIds,
      selectedSessionId,
      setSessions,
      setSessionMessages,
    ]
  );

  const handleApprovalSelect = useCallback(
    async (request: ApprovalRequest, optionId: string) => {
      const key = `${request.sessionId}:${request.requestId}`;
      setApprovalLoading((prev) => ({ ...prev, [key]: true }));
      try {
        const feedback = approvalFeedback[key]?.trim();
        if (feedback) {
          console.debug('[approval feedback]', { requestId: request.requestId, feedback });
        }
        await approveRequest(request.sessionId, request.requestId, undefined, optionId);
        setPendingApprovals((prev) =>
          prev.filter(
            (item) =>
              !(item.sessionId === request.sessionId && item.requestId === request.requestId)
          )
        );
        setApprovalFeedback((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setApprovalLoading((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } catch (err) {
        console.error('[approval failed]', err);
        setApprovalLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [approvalFeedback]
  );

  const approvalCards: ApprovalProps[] = pendingApprovals
    .filter((request) => resolveChatSessionId(request.sessionId) === selectedSessionId)
    .map((request) => {
      const toolCall = asRecord(request.toolCall) ?? {};
      const toolKind = normalizeToolKind(toolCall.kind);
      const type = toolKind === 'edit' ? 'patch' : 'exec';
      const title = getString(toolCall.title ?? toolCall.name) ?? 'Approval Required';
      const description = extractApprovalDescription(toolCall);
      const command = extractCommand(toolCall.rawInput ?? toolCall.raw_input);
      const diffs = extractApprovalDiffs(toolCall);
      const options = mapApprovalOptions(request.options);
      const key = `${request.sessionId}:${request.requestId}`;

      return {
        callId: request.requestId,
        type,
        title,
        status: 'pending',
        description,
        command,
        diffs: diffs.length > 0 ? diffs : undefined,
        options: options.length > 0 ? options : undefined,
        feedback: approvalFeedback[key] ?? '',
        onFeedbackChange: (next) =>
          setApprovalFeedback((prev) => ({ ...prev, [key]: next })),
        loading: approvalLoading[key] ?? false,
        onSelect: (_callId, optionId) => handleApprovalSelect(request, optionId),
      };
    });

  return (
    <ChatContainer
      sessions={sessions}
      selectedSessionId={selectedSessionId}
      messages={messages}
      approvals={approvalCards}
      sidebarVisible={sidebarVisible}
      isGenerating={isGenerating}
      inputPlaceholder={inputPlaceholder}
      onSessionSelect={handleSessionSelect}
      onNewChat={handleNewChat}
      onSendMessage={handleSendMessage}
      onSessionDelete={handleSessionDelete}
      onSessionRename={handleSessionRename}
      onSidebarToggle={() => setSidebarVisible((v) => !v)}
    />
  );
}

export default App;
