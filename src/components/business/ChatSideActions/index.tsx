import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { IconButton } from '../../ui/data-entry/IconButton';
import { FolderIcon, GitBranchIcon, ServerIcon, TerminalIcon } from '../../ui/data-display/Icon';
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

export const ChatSideActions = memo(function ChatSideActions({
  className = '',
  onAction,
}: ChatSideActionsProps) {
  const { t } = useTranslation();
  const actions = useMemo<ChatSideAction[]>(
    () => [
      { id: 'explorer', label: t('chatSideActions.explorer'), icon: <FolderIcon size={18} /> },
      { id: 'git', label: t('chatSideActions.git'), icon: <GitBranchIcon size={18} /> },
      { id: 'terminal', label: t('chatSideActions.terminal'), icon: <TerminalIcon size={18} /> },
      { id: 'remote', label: t('chatSideActions.remote'), icon: <ServerIcon size={18} /> },
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
});

ChatSideActions.displayName = 'ChatSideActions';

export type { ChatSideActionsProps };
