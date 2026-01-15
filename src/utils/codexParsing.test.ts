import { describe, it, expect } from 'vitest';

import {
  applyToolCallUpdate,
  extractSlashCommands,
  mergeSelectOptions,
  parseToolCall,
  resolveModelOptions,
} from './codexParsing';

describe('codexParsing', () => {
  it('extracts and normalizes slash commands', () => {
    const commands = extractSlashCommands([{ name: '/review' }, ' /init ', { command: 'compact' }]);
    expect(commands).toEqual(['compact', 'init', 'review']);
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
});
