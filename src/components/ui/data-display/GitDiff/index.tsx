import { useMemo } from 'react';

import { cn } from '../../../../utils/cn';

import type { GitDiffProps, FileDiff, DiffLine, DiffLineType } from './types';

import './GitDiff.css';

/** 解析 unified diff 格式 */
function parseDiff(diffText: string): FileDiff {
  const lines = diffText.split('\n');
  const result: FileDiff = {
    oldPath: '',
    newPath: '',
    lines: [],
  };

  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    // 解析文件路径
    if (line.startsWith('--- ')) {
      result.oldPath = line.slice(4).replace(/^a\//, '');
      result.lines.push({ type: 'header', content: line });
      continue;
    }
    if (line.startsWith('+++ ')) {
      result.newPath = line.slice(4).replace(/^b\//, '');
      result.lines.push({ type: 'header', content: line });
      continue;
    }

    // 解析 hunk header (@@ -1,3 +1,4 @@)
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLineNum = parseInt(hunkMatch[1], 10);
      newLineNum = parseInt(hunkMatch[2], 10);
      result.lines.push({ type: 'hunk', content: line });
      continue;
    }

    // 解析 diff 内容行
    let type: DiffLineType = 'context';
    let content = line;

    if (line.startsWith('+')) {
      type = 'add';
      content = line.slice(1);
    } else if (line.startsWith('-')) {
      type = 'remove';
      content = line.slice(1);
    } else if (line.startsWith(' ')) {
      type = 'context';
      content = line.slice(1);
    } else if (line.startsWith('diff ') || line.startsWith('index ')) {
      result.lines.push({ type: 'header', content: line });
      continue;
    } else {
      continue;
    }

    const diffLine: DiffLine = { type, content };

    if (type === 'add') {
      diffLine.newLineNumber = newLineNum++;
    } else if (type === 'remove') {
      diffLine.oldLineNumber = oldLineNum++;
    } else {
      diffLine.oldLineNumber = oldLineNum++;
      diffLine.newLineNumber = newLineNum++;
    }

    result.lines.push(diffLine);
  }

  return result;
}

function getLineKey(line: DiffLine, index: number): string {
  const oldNum = line.oldLineNumber ?? '';
  const newNum = line.newLineNumber ?? '';
  const base = `${line.type}-${oldNum}-${newNum}-${line.content}`;
  return base || String(index);
}

export function GitDiff({
  diff,
  showLineNumbers = true,
  fileName,
  className,
  style,
}: GitDiffProps) {
  const fileDiff = useMemo(() => parseDiff(diff), [diff]);
  const displayFileName = fileName || fileDiff.newPath || fileDiff.oldPath;

  return (
    <div className={cn('git-diff', className)} style={style}>
      {displayFileName && (
        <div className="git-diff__header">
          <span className="git-diff__filename">{displayFileName}</span>
        </div>
      )}
      <div className="git-diff__content">
        <table className="git-diff__table">
          <tbody>
            {fileDiff.lines.map((line, index) => (
              <DiffLineRow
                key={getLineKey(line, index)}
                line={line}
                showLineNumbers={showLineNumbers}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface DiffLineRowProps {
  line: DiffLine;
  showLineNumbers: boolean;
}

function DiffLineRow({ line, showLineNumbers }: DiffLineRowProps) {
  if (line.type === 'header') {
    return (
      <tr className="git-diff__row git-diff__row--header">
        {showLineNumbers && (
          <>
            <td className="git-diff__line-number" />
            <td className="git-diff__line-number" />
          </>
        )}
        <td className="git-diff__line-content">{line.content}</td>
      </tr>
    );
  }

  if (line.type === 'hunk') {
    return (
      <tr className="git-diff__row git-diff__row--hunk">
        {showLineNumbers && (
          <>
            <td className="git-diff__line-number" />
            <td className="git-diff__line-number" />
          </>
        )}
        <td className="git-diff__line-content">{line.content}</td>
      </tr>
    );
  }

  const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';

  return (
    <tr className={cn('git-diff__row', `git-diff__row--${line.type}`)}>
      {showLineNumbers && (
        <>
          <td className="git-diff__line-number">
            {line.oldLineNumber ?? ''}
          </td>
          <td className="git-diff__line-number">
            {line.newLineNumber ?? ''}
          </td>
        </>
      )}
      <td className="git-diff__line-content">
        <span className="git-diff__prefix">{prefix}</span>
        <span className="git-diff__code">{line.content}</span>
      </td>
    </tr>
  );
}

export type { GitDiffProps, FileDiff, DiffLine, DiffLineType } from './types';
