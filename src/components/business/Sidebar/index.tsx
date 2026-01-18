import { useState, useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { List } from '../../ui/data-display/List';
import { ListItem } from '../../ui/data-display/ListItem';
import { IconButton } from '../../ui/data-entry/IconButton';
import {
  CommentIcon,
  SidebarLeftIcon,
  EditIcon,
  PencilIcon,
  MenuIcon,
  TrashIcon,
} from '../../ui/data-display/Icon';
import { cn } from '../../../utils/cn';
import { useSidebarResize } from '../../../hooks/useSidebarResize';

import type { SidebarProps } from './types';
import type { ListItemAction } from '../../ui/data-display/ListItem/types';

import './Sidebar.css';

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 200;

export function Sidebar({
  sessions,
  selectedSessionId,
  onSessionSelect,
  onNewChat,
  onMenuClick,
  onSplitViewClick,
  onSessionDelete,
  onSessionRename,
  width: controlledWidth,
  onWidthChange,
  className = '',
}: SidebarProps) {
  const { t } = useTranslation();
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const generatedId = useId();
  const safeId = generatedId.replace(/:/g, '');
  const sidebarId = `sidebar-${safeId}`;

  const { width, isDragging, sidebarRef, handleMouseDown, handleResizeKeyDown } =
    useSidebarResize({
      width: controlledWidth,
      onWidthChange,
      minWidth: MIN_WIDTH,
      maxWidth: MAX_WIDTH,
      defaultWidth: DEFAULT_WIDTH,
    });

  const handleStartRename = useCallback((sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditValue(currentTitle);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (editingSessionId && editValue.trim()) {
      onSessionRename?.(editingSessionId, editValue.trim());
    }
    setEditingSessionId(null);
    setEditValue('');
  }, [editingSessionId, editValue, onSessionRename]);

  const handleCancelRename = useCallback(() => {
    setEditingSessionId(null);
    setEditValue('');
  }, []);

  const getSessionActions = useCallback(
    (sessionId: string, title: string): ListItemAction[] => {
      const actions: ListItemAction[] = [];

      if (onSessionRename) {
        actions.push({
          icon: <PencilIcon size={14} />,
          label: t('common.rename'),
          onClick: () => handleStartRename(sessionId, title),
        });
      }

      if (onSessionDelete) {
        actions.push({
          icon: <TrashIcon size={14} />,
          label: t('common.delete'),
          onClick: () => onSessionDelete(sessionId),
        });
      }

      return actions;
    },
    [onSessionDelete, onSessionRename, handleStartRename, t]
  );

  return (
    <aside
      id={sidebarId}
      ref={sidebarRef}
      className={cn('sidebar', isDragging && 'sidebar--dragging', className)}
      style={{ width }}
    >
      <div className="sidebar__header" data-tauri-drag-region>
        <IconButton
          icon={<SidebarLeftIcon size={18} />}
          onClick={onSplitViewClick}
          aria-label={t('sidebar.toggle')}
          size="sm"
          variant="ghost"
          disabled={!onSplitViewClick}
        />
        <IconButton
          icon={<EditIcon size={18} />}
          onClick={onNewChat}
          aria-label={t('sidebar.newChat')}
          size="sm"
          variant="ghost"
          disabled={!onNewChat}
        />
      </div>

      <div className="sidebar__content">
        <List scrollable>
          {sessions.map((session) => (
            <ListItem
              key={session.id}
              icon={<CommentIcon size={18} />}
              selected={session.id === selectedSessionId}
              onClick={() => onSessionSelect?.(session.id)}
              actions={getSessionActions(session.id, session.title)}
              editing={editingSessionId === session.id}
              editValue={editValue}
              onEditChange={setEditValue}
              onEditConfirm={handleConfirmRename}
              onEditCancel={handleCancelRename}
            >
              {session.title}
            </ListItem>
          ))}
        </List>
      </div>

      <div className="sidebar__footer">
        <button
          type="button"
          className="sidebar__menu-button"
          onClick={onMenuClick}
          aria-label={t('sidebar.menu')}
        >
          <MenuIcon size={20} />
        </button>
      </div>

      <div
        className="sidebar__resize-handle"
        onMouseDown={handleMouseDown}
        onKeyDown={handleResizeKeyDown}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('sidebar.resizeAria')}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={Math.round(width)}
        aria-controls={sidebarId}
        tabIndex={0}
      />
    </aside>
  );
}

export type { SidebarProps, ChatSession } from './types';
