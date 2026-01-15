import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { IconButton } from '../../ui/data-entry/IconButton';
import { CodeIcon, GlobeIcon, SlidersIcon, TerminalIcon } from '../../ui/data-display/Icon';
import { cn } from '../../../utils/cn';

import './ChatSideActions.css';

type ChatSideAction = {
  id: string;
  label: string;
  icon: ReactNode;
};

type ChatSideActionsProps = {
  className?: string;
  onAction?: (id: string) => void;
};

export function ChatSideActions({ className = '', onAction }: ChatSideActionsProps) {
  const { t } = useTranslation();
  const actions = useMemo<ChatSideAction[]>(
    () => [
      { id: 'files', label: t('chatSideActions.files'), icon: <CodeIcon size={18} /> },
      { id: 'tools', label: t('chatSideActions.tools'), icon: <SlidersIcon size={18} /> },
      { id: 'terminal', label: t('chatSideActions.terminal'), icon: <TerminalIcon size={18} /> },
      { id: 'web', label: t('chatSideActions.web'), icon: <GlobeIcon size={18} /> },
    ],
    [t]
  );

  return (
    <div
      className={cn('chat-side-actions', className)}
      role="toolbar"
      aria-label={t('chatSideActions.label')}
    >
      {actions.map((action) => (
        <IconButton
          key={action.id}
          icon={action.icon}
          size="sm"
          variant="ghost"
          aria-label={action.label}
          title={action.label}
          onClick={() => onAction?.(action.id)}
        />
      ))}
    </div>
  );
}

export type { ChatSideActionsProps };
