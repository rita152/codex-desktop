import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { IconButton } from '../../ui/data-entry/IconButton';
import {
  FolderIcon,
  GitBranchIcon,
  ServerIcon,
  TerminalIcon,
  ListIcon,
} from '../../ui/data-display/Icon';
import { cn } from '../../../utils/cn';

import './ChatSideActions.css';

type ChatSideAction = {
  id: string;
  label: string;
  icon: ReactNode;
  hidden?: boolean;
  highlight?: boolean;
};

type ChatSideActionsProps = {
  className?: string;
  onAction?: (id: string) => void;
  /** Whether there's an active plan to show */
  hasPlan?: boolean;
};

export const ChatSideActions = memo(function ChatSideActions({
  className = '',
  onAction,
  hasPlan = false,
}: ChatSideActionsProps) {
  const { t } = useTranslation();
  const actions = useMemo<ChatSideAction[]>(
    () => [
      {
        id: 'plan',
        label: t('chatSideActions.plan', { defaultValue: 'Plan' }),
        icon: <ListIcon size={18} />,
        hidden: !hasPlan,
        highlight: true,
      },
      { id: 'explorer', label: t('chatSideActions.explorer'), icon: <FolderIcon size={18} /> },
      { id: 'git', label: t('chatSideActions.git'), icon: <GitBranchIcon size={18} /> },
      { id: 'terminal', label: t('chatSideActions.terminal'), icon: <TerminalIcon size={18} /> },
      { id: 'remote', label: t('chatSideActions.remote'), icon: <ServerIcon size={18} /> },
    ],
    [t, hasPlan]
  );

  return (
    <div
      className={cn('chat-side-actions', className)}
      role="toolbar"
      aria-label={t('chatSideActions.label')}
    >
      {actions
        .filter((action) => !action.hidden)
        .map((action) => (
          <IconButton
            key={action.id}
            icon={action.icon}
            size="sm"
            variant="ghost"
            aria-label={action.label}
            title={action.label}
            onClick={() => onAction?.(action.id)}
            className={cn(action.highlight && 'chat-side-actions__highlight')}
          />
        ))}
    </div>
  );
});

ChatSideActions.displayName = 'ChatSideActions';

export type { ChatSideActionsProps };
