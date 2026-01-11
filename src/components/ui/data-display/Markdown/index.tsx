import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '../../../../utils/cn';

import type { MarkdownProps } from './types';

import './Markdown.css';

export function Markdown({ content, className = '' }: MarkdownProps) {
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
        {content}
      </ReactMarkdown>
    </div>
  );
}

export type { MarkdownProps } from './types';
