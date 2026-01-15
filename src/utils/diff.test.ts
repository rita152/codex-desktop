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
});
