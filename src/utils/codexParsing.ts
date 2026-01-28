import { buildUnifiedDiff } from './diff';

import type { SelectOption } from '../types/options';
import type {
  ApprovalDiff,
  ApprovalStatus,
  PermissionOption as ApprovalOption,
  PermissionOptionKind,
} from '../components/ui/feedback/Approval';
import type {
  ToolCallContent,
  ToolCallLocation,
  ToolCallProps,
  ToolCallStatus,
  ToolKind,
  TerminalContent,
} from '../components/ui/feedback/ToolCall';
import type { PermissionOption } from '../types/codex';

export type UnknownRecord = Record<string, unknown>;

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function newMessageId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object') return null;
  return value as UnknownRecord;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function normalizeToolCallStatus(value: unknown): ToolCallStatus {
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

export function normalizeToolKind(value: unknown): ToolKind | undefined {
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

export function normalizePermissionKind(value: unknown): PermissionOptionKind {
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
  return asRecord(raw._meta) ?? asRecord(raw.meta) ?? null;
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

export function getToolCallId(raw: UnknownRecord): string {
  const id = getString(raw.toolCallId ?? raw.tool_call_id ?? raw.id);
  return id ?? '';
}

export function parseToolCall(raw: UnknownRecord): ToolCallProps {
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

export function applyToolCallUpdate(
  existing: ToolCallProps | undefined,
  raw: UnknownRecord
): ToolCallProps {
  const meta = extractMeta(raw);
  const toolCallId = getToolCallId(raw) || existing?.toolCallId || newMessageId();
  const status = raw.status ? normalizeToolCallStatus(raw.status) : (existing?.status ?? 'pending');
  const kind = normalizeToolKind(raw.kind ?? existing?.kind);
  const title = getString(raw.title) ?? existing?.title ?? 'Tool Call';
  const locations = raw.locations ? parseToolCallLocations(raw.locations) : existing?.locations;
  const rawInput = raw.rawInput ?? raw.raw_input ?? existing?.rawInput;
  const rawOutput = raw.rawOutput ?? raw.raw_output ?? existing?.rawOutput;

  const parsedContent = parseToolCallContent(raw.content);
  const mergedContent = applyTerminalMeta(parsedContent ?? existing?.content, meta);

  const startTime = existing?.startTime ?? (status === 'in-progress' ? Date.now() : undefined);
  const duration =
    (status === 'completed' || status === 'failed') && startTime
      ? (existing?.duration ?? (Date.now() - startTime) / 1000)
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

export function extractCommand(rawInput: unknown): string | undefined {
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

function parseModelOptionsFromSessionModels(
  raw: unknown
): { currentModelId?: string; options: SelectOption[] } | null {
  const record = asRecord(raw);
  if (!record) return null;
  const currentModelId = getString(record.currentModelId ?? record.current_model_id);
  const available = asArray(record.availableModels ?? record.available_models);
  const options = available
    .map((item) => {
      const optionRecord = asRecord(item);
      if (!optionRecord) return null;
      const value =
        getString(optionRecord.modelId ?? optionRecord.model_id ?? optionRecord.id) ?? undefined;
      if (!value) return null;
      const label = getString(optionRecord.name) ?? value;
      return { value, label };
    })
    .filter(Boolean) as SelectOption[];

  if (options.length === 0 && !currentModelId) return null;
  return { currentModelId, options };
}

function parseModeOptionsFromSessionModes(
  raw: unknown
): { currentModeId?: string; options: SelectOption[] } | null {
  const record = asRecord(raw);
  if (!record) return null;
  const currentModeId = getString(record.currentModeId ?? record.current_mode_id);
  const available = asArray(record.availableModes ?? record.available_modes);
  const options = available
    .map((item) => {
      const optionRecord = asRecord(item);
      if (!optionRecord) return null;
      const value = getString(optionRecord.id ?? optionRecord.modeId ?? optionRecord.mode_id);
      if (!value) return null;
      const label = getString(optionRecord.name ?? optionRecord.label) ?? value;
      return { value, label };
    })
    .filter(Boolean) as SelectOption[];

  if (options.length === 0 && !currentModeId) return null;
  return { currentModeId, options };
}

function parseModelOptionsFromConfigOptions(
  raw: unknown
): { currentModelId?: string; options: SelectOption[] } | null {
  const configOptions = asArray(raw);
  if (configOptions.length === 0) return null;

  const target = configOptions
    .map((item) => asRecord(item))
    .find((record) => {
      if (!record) return false;
      const id = getString(record.id);
      return id?.toLowerCase() === 'model';
    });

  if (!target) return null;
  const currentModelId = getString(target.currentValue ?? target.current_value);
  const optionsField = target.options;
  const options: SelectOption[] = [];

  const pushOption = (option: UnknownRecord) => {
    const value = getString(option.value);
    if (!value) return;
    const label = getString(option.name) ?? value;
    options.push({ value, label });
  };

  for (const item of asArray(optionsField)) {
    const itemRecord = asRecord(item);
    if (!itemRecord) continue;
    const grouped = asArray(itemRecord.options);
    if (grouped.length > 0) {
      grouped.forEach((groupItem) => {
        const optionRecord = asRecord(groupItem);
        if (optionRecord) pushOption(optionRecord);
      });
      continue;
    }
    pushOption(itemRecord);
  }

  if (options.length === 0 && !currentModelId) return null;
  return { currentModelId, options };
}

function parseModeOptionsFromConfigOptions(
  raw: unknown
): { currentModeId?: string; options: SelectOption[] } | null {
  const configOptions = asArray(raw);
  if (configOptions.length === 0) return null;

  const target = configOptions
    .map((item) => asRecord(item))
    .find((record) => {
      if (!record) return false;
      const id = getString(record.id);
      return id?.toLowerCase() === 'mode';
    });

  if (!target) return null;
  const currentModeId = getString(target.currentValue ?? target.current_value);
  const optionsField = target.options;
  const options: SelectOption[] = [];

  const pushOption = (option: UnknownRecord) => {
    const value = getString(option.value);
    if (!value) return;
    const label = getString(option.name) ?? value;
    options.push({ value, label });
  };

  for (const item of asArray(optionsField)) {
    const itemRecord = asRecord(item);
    if (!itemRecord) continue;
    const grouped = asArray(itemRecord.options);
    if (grouped.length > 0) {
      grouped.forEach((groupItem) => {
        const optionRecord = asRecord(groupItem);
        if (optionRecord) pushOption(optionRecord);
      });
      continue;
    }
    pushOption(itemRecord);
  }

  if (options.length === 0 && !currentModeId) return null;
  return { currentModeId, options };
}

export function resolveModelOptions(
  models: unknown,
  configOptions: unknown
): { currentModelId?: string; options: SelectOption[] } | null {
  return (
    parseModelOptionsFromSessionModels(models) ?? parseModelOptionsFromConfigOptions(configOptions)
  );
}

export function resolveModeOptions(
  modes: unknown,
  configOptions: unknown
): { currentModeId?: string; options: SelectOption[] } | null {
  return (
    parseModeOptionsFromSessionModes(modes) ?? parseModeOptionsFromConfigOptions(configOptions)
  );
}

export function extractSlashCommands(update: unknown): string[] {
  const updateRecord = asRecord(update);
  const candidates = Array.isArray(update)
    ? update
    : asArray(
        updateRecord?.commands ??
          updateRecord?.available_commands ??
          updateRecord?.availableCommands
      );
  if (candidates.length === 0) return [];

  const names = new Set<string>();
  for (const cmd of candidates) {
    if (typeof cmd === 'string') {
      const name = cmd.trim().replace(/^\//, '');
      if (name) names.add(name);
      continue;
    }
    const record = asRecord(cmd);
    if (!record) continue;
    const name = getString(record.name ?? record.command);
    if (name) {
      const cleaned = name.trim().replace(/^\//, '');
      if (cleaned) names.add(cleaned);
    }
  }
  return Array.from(names).sort();
}

export function mapApprovalOptions(options: PermissionOption[] | undefined): ApprovalOption[] {
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

export function approvalStatusFromKind(kind: PermissionOptionKind): ApprovalStatus {
  switch (kind) {
    case 'allow-always':
      return 'approved-for-session';
    case 'reject-always':
    case 'reject-once':
      return 'rejected';
    case 'allow-once':
    default:
      return 'approved';
  }
}

export function extractApprovalDiffs(toolCall: UnknownRecord): ApprovalDiff[] {
  const content = parseToolCallContent(toolCall.content);
  if (!content) return [];
  return content
    .filter((item) => item.type === 'diff')
    .map((item) => ({
      path: item.path,
      diff: item.diff,
    }));
}

export function extractApprovalDescription(toolCall: UnknownRecord): string | undefined {
  const content = parseToolCallContent(toolCall.content);
  if (!content) return undefined;
  const texts = content
    .filter((item) => item.type === 'text')
    .map((item) => item.text.trim())
    .filter(Boolean);
  return texts.length > 0 ? texts.join('\n\n') : undefined;
}

export function mergeSelectOptions(
  primary: SelectOption[],
  fallback: SelectOption[]
): SelectOption[] {
  if (primary.length === 0) return fallback;
  if (fallback.length === 0) return primary;
  const seen = new Set(primary.map((option) => option.value));
  const merged = [...primary];
  for (const option of fallback) {
    if (seen.has(option.value)) continue;
    seen.add(option.value);
    merged.push(option);
  }
  return merged;
}
