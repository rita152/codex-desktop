import './Sidebar.css';

import { List } from '../../ui/data-display/List';
import { ListItem } from '../../ui/data-display/ListItem';
import { IconButton } from '../../ui/data-entry/IconButton';
import {
  CommentIcon,
  SidebarLeftIcon,
  EditIcon,
  MenuIcon,
} from '../../ui/data-display/Icon';

import type { SidebarProps } from './types';

export function Sidebar({
  sessions,
  selectedSessionId,
  onSessionSelect,
  onNewChat,
  onMenuClick,
  onSplitViewClick,
  className = '',
}: SidebarProps) {
  return (
    <aside className={`sidebar ${className}`}>
      <div className="sidebar__header">
        <IconButton
          icon={<SidebarLeftIcon size={18} />}
          onClick={onSplitViewClick}
          aria-label="切换分栏"
          size="sm"
          variant="ghost"
        />
        <IconButton
          icon={<EditIcon size={18} />}
          onClick={onNewChat}
          aria-label="新建对话"
          size="sm"
          variant="ghost"
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
          aria-label="菜单"
        >
          <MenuIcon size={20} />
        </button>
      </div>
    </aside>
  );
}

export type { SidebarProps, ChatSession } from './types';
