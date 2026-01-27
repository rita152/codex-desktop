import { describe, it, expect, vi } from 'vitest';

import {
  approvalStatusFromKind,
  asArray,
  asRecord,
  applyToolCallUpdate,
  extractApprovalDescription,
  extractApprovalDiffs,
  extractCommand,
  extractSlashCommands,
  formatError,
  getNumber,
  getString,
  mapApprovalOptions,
  mergeSelectOptions,
  newMessageId,
  parseToolCall,
  resolveModelOptions,
  resolveModeOptions,
  safeJson,
  normalizePermissionKind,
  normalizeToolCallStatus,
  normalizeToolKind,
} from './codexParsing';

describe('codexParsing', () => {
  it('extracts and normalizes slash commands', () => {
    const commands = extractSlashCommands([{ name: '/review' }, ' /init ', { command: 'compact' }]);
    expect(commands).toEqual(['compact', 'init', 'review']);
  });

  it('handles helpers and normalization utilities', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(safeJson({ ok: true })).toContain('"ok": true');
    expect(safeJson(circular)).toBe('[object Object]');
    expect(formatError(new Error('boom'))).toBe('boom');
    expect(formatError('oops')).toBe('oops');
    expect(asRecord({ value: 1 })?.value).toBe(1);
    expect(asRecord(null)).toBeNull();
    expect(asArray('nope')).toEqual([]);
    expect(asArray([1, 2])).toEqual([1, 2]);
    expect(getString(1)).toBeUndefined();
    expect(getString('ok')).toBe('ok');
    expect(getNumber('1')).toBeUndefined();
    expect(getNumber(1)).toBe(1);
    const id = newMessageId();
    expect(id).toContain('-');
  });

  it('normalizes statuses, tool kinds, and permission kinds', () => {
    expect(normalizeToolCallStatus('in_progress')).toBe('in-progress');
    expect(normalizeToolCallStatus('in-progress')).toBe('in-progress');
    expect(normalizeToolCallStatus('completed')).toBe('completed');
    expect(normalizeToolCallStatus('failed')).toBe('failed');
    expect(normalizeToolCallStatus('unknown')).toBe('pending');

    expect(normalizeToolKind('read')).toBe('read');
    expect(normalizeToolKind('delete')).toBe('edit');
    expect(normalizeToolKind('move')).toBe('edit');
    expect(normalizeToolKind('execute')).toBe('execute');
    expect(normalizeToolKind('search')).toBe('search');
    expect(normalizeToolKind('fetch')).toBe('fetch');
    expect(normalizeToolKind('browser')).toBe('browser');
    expect(normalizeToolKind('mcp')).toBe('mcp');
    expect(normalizeToolKind('custom')).toBe('other');
    expect(normalizeToolKind(undefined)).toBeUndefined();

    expect(normalizePermissionKind('allow_always')).toBe('allow-always');
    expect(normalizePermissionKind('allow-once')).toBe('allow-once');
    expect(normalizePermissionKind('reject_always')).toBe('reject-always');
    expect(normalizePermissionKind('reject_once')).toBe('reject-once');
    expect(normalizePermissionKind('abort')).toBe('reject-once');
    expect(normalizePermissionKind('unknown')).toBe('allow-once');
  });

  it('merges select options without duplicates', () => {
    const merged = mergeSelectOptions(
      [{ value: 'a', label: 'A' }],
      [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ]
    );
    expect(merged.map((item) => item.value)).toEqual(['a', 'b']);
  });

  it('handles empty select option inputs', () => {
    expect(mergeSelectOptions([], [{ value: 'b', label: 'B' }])).toEqual([
      { value: 'b', label: 'B' },
    ]);
    expect(mergeSelectOptions([{ value: 'a', label: 'A' }], [])).toEqual([
      { value: 'a', label: 'A' },
    ]);
  });

  it('parses tool call diff content', () => {
    const parsed = parseToolCall({
      toolCallId: 'tool-1',
      title: 'Edit',
      kind: 'edit',
      status: 'completed',
      content: [
        {
          type: 'diff',
          path: 'foo.txt',
          oldText: 'a',
          newText: 'b',
        },
      ],
    });
    expect(parsed.toolCallId).toBe('tool-1');
    expect(parsed.status).toBe('completed');
    expect(parsed.content?.[0].type).toBe('diff');
    const diff = (parsed.content?.[0] as { diff: string }).diff;
    expect(diff).toContain('--- a/foo.txt');
  });

  it('parses tool call content with metadata and locations', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const now = Date.now();

    const parsed = parseToolCall({
      id: 'tool-2',
      name: 'Tool Call',
      kind: 'execute',
      status: 'in_progress',
      locations: [
        { uri: 'foo.txt', start_line: 2 },
        { path: 'bar.txt', line: 4 },
        { path: '' },
        null,
      ],
      content: [
        { type: 'content', content: { type: 'text', text: 'hello' } },
        {
          type: 'content',
          content: { type: 'resource_link', name: 'Doc', uri: 'https://example.com' },
        },
        { type: 'content', content: { type: 'object', value: 1 } },
        { type: 'diff', path: 'a.txt', old_text: 'a', new_text: 'b' },
        { type: 'terminal', terminal_id: 'term-1' },
      ],
      meta: {
        terminal_info: { terminal_id: 'term-1', cwd: '/home' },
        terminal_output: { terminal_id: 'term-1', data: 'out' },
        terminal_exit: { terminal_id: 'term-1', exit_code: 0, signal: 'SIGTERM' },
      },
    });

    vi.useRealTimers();

    expect(parsed.toolCallId).toBe('tool-2');
    expect(parsed.kind).toBe('execute');
    expect(parsed.status).toBe('in-progress');
    expect(parsed.startTime).toBe(now);
    expect(parsed.locations).toHaveLength(2);
    expect(parsed.locations?.[0]?.range?.startLine).toBe(2);
    expect(parsed.content?.some((item) => item.type === 'diff')).toBe(true);
    expect(
      parsed.content?.some(
        (item) => item.type === 'text' && item.text.includes('Doc (https://example.com)')
      )
    ).toBe(true);
    expect(
      parsed.content?.some((item) => item.type === 'text' && item.text.includes('"type": "object"'))
    ).toBe(true);
    const terminal = parsed.content?.find(
      (item) => item.type === 'terminal' && item.terminalId === 'term-1'
    );
    expect(terminal?.type).toBe('terminal');
    if (terminal && terminal.type === 'terminal') {
      expect(terminal.cwd).toBe('/home');
      expect(terminal.output).toBe('out');
      expect(terminal.exitCode).toBe(0);
      expect(terminal.signal).toBe('SIGTERM');
    }
  });

  it('keeps existing duration on tool call update', () => {
    const next = applyToolCallUpdate(
      {
        toolCallId: 'tool-2',
        title: 'Tool Call',
        status: 'in-progress',
        kind: 'read',
        startTime: 1000,
        duration: 3,
      },
      { status: 'completed' }
    );
    expect(next.status).toBe('completed');
    expect(next.duration).toBe(3);
  });

  it('computes duration and updates terminal output on tool call update', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const existing = parseToolCall({
      toolCallId: 'tool-3',
      title: 'Tool Call',
      status: 'in_progress',
      kind: 'read',
    });

    vi.setSystemTime(new Date('2024-01-01T00:00:02Z'));
    const updated = applyToolCallUpdate(existing, {
      status: 'completed',
      content: [{ type: 'terminal', terminal_id: 'term-2' }],
      meta: { terminal_output: { terminal_id: 'term-2', data: 'ok' } },
    });
    vi.useRealTimers();

    expect(updated.status).toBe('completed');
    expect(updated.duration).toBe(2);
    const terminal = updated.content?.find(
      (item) => item.type === 'terminal' && item.terminalId === 'term-2'
    );
    expect(terminal?.type).toBe('terminal');
    if (terminal && terminal.type === 'terminal') {
      expect(terminal.output).toBe('ok');
    }
  });

  it('extracts commands from raw input', () => {
    expect(extractCommand({ cmd: 'ls -la' })).toBe('ls -la');
    expect(extractCommand({ command: ['git', 'status'] })).toBe('git status');
    expect(extractCommand({ parsed_cmd: [{ cmd: 'echo hi' }] })).toBe('echo hi');
    expect(extractCommand('nope')).toBeUndefined();
  });

  it('resolves model options from session models', () => {
    const result = resolveModelOptions(
      {
        current_model_id: 'gpt',
        available_models: [{ model_id: 'gpt', name: 'GPT-Model' }],
      },
      []
    );
    expect(result?.currentModelId).toBe('gpt');
    expect(result?.options).toEqual([{ value: 'gpt', label: 'GPT-Model' }]);
  });

  it('resolves mode options from session modes', () => {
    const result = resolveModeOptions(
      {
        current_mode_id: 'agent-full',
        available_modes: [{ id: 'agent-full', name: 'Agent (full access)' }],
      },
      []
    );
    expect(result?.currentModeId).toBe('agent-full');
    expect(result?.options).toEqual([{ value: 'agent-full', label: 'Agent (full access)' }]);
  });

  it('resolves options from config options', () => {
    const configOptions = [
      {
        id: 'model',
        current_value: 'gpt-4',
        options: [
          { value: 'gpt-3', name: 'GPT-3' },
          { options: [{ value: 'gpt-4', name: 'GPT-4' }] },
          { value: '' },
        ],
      },
      {
        id: 'mode',
        currentValue: 'fast',
        options: [{ value: 'fast', label: 'Fast' }, { options: [{ value: 'safe', name: 'Safe' }] }],
      },
    ];

    const model = resolveModelOptions(null, configOptions);
    const mode = resolveModeOptions(null, configOptions);

    expect(model?.currentModelId).toBe('gpt-4');
    expect(model?.options.map((item) => item.value)).toEqual(['gpt-3', 'gpt-4']);
    expect(mode?.currentModeId).toBe('fast');
    expect(mode?.options.map((item) => item.value)).toEqual(['fast', 'safe']);
    expect(resolveModelOptions(null, [])).toBeNull();
    expect(resolveModeOptions(null, [])).toBeNull();
  });

  it('extracts approval content and descriptions', () => {
    const toolCall = {
      content: [
        { type: 'content', content: { type: 'text', text: 'Approve this' } },
        { type: 'diff', path: 'file.txt', oldText: 'a', newText: 'b' },
      ],
    };

    expect(extractApprovalDiffs(toolCall)).toEqual([
      { path: 'file.txt', diff: expect.stringContaining('@@') },
    ]);
    expect(extractApprovalDescription(toolCall)).toBe('Approve this');
    expect(extractApprovalDescription({ content: [] })).toBeUndefined();
  });

  it('maps approval options and statuses', () => {
    const mapped = mapApprovalOptions([
      { option_id: 'allow', label: 'Allow', kind: 'allow_once' },
      { id: 'reject', name: 'Reject', kind: 'reject_always' },
      { name: 'skip' },
    ]);

    expect(mapped).toEqual([
      { id: 'allow', label: 'Allow', kind: 'allow-once' },
      { id: 'reject', label: 'Reject', kind: 'reject-always' },
    ]);
    expect(approvalStatusFromKind('allow-always')).toBe('approved-for-session');
    expect(approvalStatusFromKind('reject-once')).toBe('rejected');
    expect(approvalStatusFromKind('allow-once')).toBe('approved');
  });
});
