type DiffOp = {
  type: 'context' | 'add' | 'remove';
  text: string;
};

function splitLines(text: string): string[] {
  if (!text) return [];
  return text.split('\n');
}

function buildLcsMatrix(a: string[], b: string[]): number[][] {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  return dp;
}

function buildDiffOps(oldLines: string[], newLines: string[]): DiffOp[] {
  const ops: DiffOp[] = [];
  const dp = buildLcsMatrix(oldLines, newLines);
  let i = 0;
  let j = 0;

  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ type: 'context', text: oldLines[i] });
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'remove', text: oldLines[i] });
      i += 1;
    } else {
      ops.push({ type: 'add', text: newLines[j] });
      j += 1;
    }
  }

  while (i < oldLines.length) {
    ops.push({ type: 'remove', text: oldLines[i] });
    i += 1;
  }

  while (j < newLines.length) {
    ops.push({ type: 'add', text: newLines[j] });
    j += 1;
  }

  return ops;
}

export function buildUnifiedDiff(
  path: string,
  oldText?: string | null,
  newText?: string | null
): string {
  const safePath = path || 'unknown';
  const oldLines = splitLines(oldText ?? '');
  const newLines = splitLines(newText ?? '');
  const ops = buildDiffOps(oldLines, newLines);

  const oldCount = oldLines.length;
  const newCount = newLines.length;
  const oldStart = oldCount > 0 ? 1 : 0;
  const newStart = newCount > 0 ? 1 : 0;

  const header = [
    `--- a/${safePath}`,
    `+++ b/${safePath}`,
    `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
  ];

  const body = ops.map((line) => {
    const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
    return `${prefix}${line.text}`;
  });

  return [...header, ...body].join('\n');
}
