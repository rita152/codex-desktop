import { describe, it, expect, beforeEach } from 'vitest';

import { createTestMessage, createTestSession, resetAllStores } from './testUtils';

describe('testUtils', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('createTestSession should apply defaults and overrides', () => {
    const s = createTestSession({ id: 's1', title: 'Hello', model: 'm1', mode: 'agent' });
    expect(s.id).toBe('s1');
    expect(s.title).toBe('Hello');
    expect(s.model).toBe('m1');
    expect(s.mode).toBe('agent');
  });

  it('createTestMessage should apply defaults and overrides', () => {
    const msg = createTestMessage({ id: 'm1', role: 'assistant', content: 'hi' });
    expect(msg.id).toBe('m1');
    expect(msg.role).toBe('assistant');
    expect(msg.content).toBe('hi');
    expect(msg.timestamp).toBeInstanceOf(Date);
  });
});
