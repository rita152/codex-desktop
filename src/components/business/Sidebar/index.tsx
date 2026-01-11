import { useState, useRef, useCallback, useEffect } from 'react';

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

import './Sidebar.css';

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 260;

export function Sidebar({
  sessions,
  selectedSessionId,
  onSessionSelect,
  onNewChat,
  onMenuClick,
  onSplitViewClick,
  width: controlledWidth,
  onWidthChange,
  className = '',
}: SidebarProps) {
  const [internalWidth, setInternalWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const width = controlledWidth ?? internalWidth;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !sidebarRef.current) return;

      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - sidebarRect.left;
      const clampedWidth = Math.min(Math.max(newWidth, MIN_WIDTH), MAX_WIDTH);

      if (onWidthChange) {
        onWidthChange(clampedWidth);
      } else {
        setInternalWidth(clampedWidth);
      }
    },
    [isDragging, onWidthChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar ${isDragging ? 'sidebar--dragging' : ''} ${className}`}
      style={{ width }}
    >
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

      <div
        className="sidebar__resize-handle"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
      />
    </aside>
  );
}

export type { SidebarProps, ChatSession } from './types';
