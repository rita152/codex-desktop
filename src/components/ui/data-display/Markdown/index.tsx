import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '../../../../utils/cn';

import type { MarkdownProps } from './types';

import './Markdown.css';

export function Markdown({ content, compact = false, className = '' }: MarkdownProps) {
  let normalizedContent = content;
  if (compact) {
    // 将所有换行统一处理：保留段落分隔，其余合并为空格
    normalizedContent = content
      .split(/\n{2,}/)           // 按段落分隔（2个及以上换行）
      .map(p => p.replace(/\n/g, ' ').trim())  // 段落内换行替换为空格
      .filter(p => p.length > 0) // 移除空段落
      .join('\n\n');             // 用双换行重新连接段落
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
