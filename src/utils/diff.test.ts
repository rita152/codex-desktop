import { describe, it, expect } from 'vitest';

import { buildUnifiedDiff } from './diff';

describe('buildUnifiedDiff', () => {
  it('formats header and changes', () => {
    const diff = buildUnifiedDiff('file.txt', 'a\nb', 'a\nc');
    expect(diff).toContain('--- a/file.txt');
    expect(diff).toContain('+++ b/file.txt');
    expect(diff).toContain('@@ -1,2 +1,2 @@');
    expect(diff).toContain('-b');
    expect(diff).toContain('+c');
  });

  it('handles empty paths and new content', () => {
    const diff = buildUnifiedDiff('', null, 'line');
    expect(diff).toContain('--- a/unknown');
    expect(diff).toContain('@@ -0,0 +1,1 @@');
    expect(diff).toContain('+line');
  });

  it('handles removals when new content is empty', () => {
    const diff = buildUnifiedDiff('file.txt', 'old', '');
    expect(diff).toContain('-old');
  });
});
