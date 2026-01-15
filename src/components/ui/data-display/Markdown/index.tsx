import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import { cn } from '../../../../utils/cn';

import type { MarkdownProps } from './types';

import './Markdown.css';

const normalizeMathDelimiters = (raw: string): string => {
  if (!raw) return raw;
  const segments = raw.split(/(```[\s\S]*?```|`[^`]*`)/g);
  return segments
    .map((segment) => {
      if (!segment || segment.startsWith('`')) return segment;
      return segment
        .replace(/\\\[((?:.|\n)*?)\\\]/g, '$$$$ $1 $$$$')
        .replace(/\\\(((?:.|\n)*?)\\\)/g, '$$$1$$');
    })
    .join('');
};

export const Markdown = memo(function Markdown({
  content,
  compact = false,
  className = '',
}: MarkdownProps) {
  const normalizedContent = useMemo(() => {
    let nextContent = content;
    if (compact) {
      // 将所有换行统一处理：保留段落分隔，其余合并为空格
      nextContent = content
        .split(/\n{2,}/) // 按段落分隔（2个及以上换行）
        .map((p) => p.replace(/\n/g, ' ').trim()) // 段落内换行替换为空格
        .filter((p) => p.length > 0) // 移除空段落
        .join('\n\n'); // 用双换行重新连接段落
    }
    return normalizeMathDelimiters(nextContent);
  }, [compact, content]);

  return (
    <div className={cn('markdown', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre({ children }) {
            return <pre className="markdown__pre">{children}</pre>;
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !className;

            if (isInline) {
              return (
                <code className="markdown__code--inline" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <code className={cn('markdown__code', className)} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
});

Markdown.displayName = 'Markdown';

export type { MarkdownProps } from './types';
