import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '../../../../utils/cn';

import type { MarkdownProps } from './types';

import './Markdown.css';

export function Markdown({ content, compact = false, className = '' }: MarkdownProps) {
  let normalizedContent = content;
  if (compact) {
    // 先将单个换行替换为空格，再合并连续换行
    normalizedContent = content
      .replace(/([^\n])\n([^\n])/g, '$1 $2')  // 单个换行 → 空格
      .replace(/\n{2,}/g, '\n\n');             // 多个换行 → 两个换行
  }

  return (
    <div className={cn('markdown', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
}

export type { MarkdownProps } from './types';
