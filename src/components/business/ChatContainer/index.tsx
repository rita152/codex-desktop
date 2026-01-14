import { useState } from 'react';

import { Sidebar } from '../Sidebar';
import { ChatMessageList } from '../ChatMessageList';
import { ChatInput } from '../ChatInput';
import { IconButton } from '../../ui/data-entry/IconButton';
import { FolderIcon, SidebarLeftIcon } from '../../ui/data-display/Icon';
import { cn } from '../../../utils/cn';

import type { ChatContainerProps } from './types';

import './ChatContainer.css';

const DEFAULT_SIDEBAR_WIDTH = 200;

export function ChatContainer({
  sessions,
  selectedSessionId,
  sessionTitle,
  sessionModel,
  sessionCwd,
  sessionNotice,
  messages,
  approvals,
  isGenerating = false,
  inputValue,
  onInputChange,
  modelOptions,
  selectedModel,
  onModelChange,
  slashCommands,
  inputPlaceholder,
  onSessionSelect,
  onNewChat,
  onSendMessage,
  onSelectCwd,
  onSessionDelete,
  onSessionRename,
  sidebarVisible = true,
  onSidebarToggle,
  welcomeContent,
  className = '',
}: ChatContainerProps) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [selectedAgent, setSelectedAgent] = useState('agent-full');

  const handleSend = (message: string) => {
    onSendMessage?.(message);
    onInputChange('');
  };

  const classNames = cn('chat-container', className);

  const showWelcome = messages.length === 0 && (!approvals || approvals.length === 0);
  const displayTitle = sessionTitle ?? sessions.find((s) => s.id === selectedSessionId)?.title;
  const displayModel = sessionModel ?? selectedModel;
  const displayCwd =
    sessionCwd && sessionCwd.trim() !== '' ? sessionCwd : '默认目录';

  return (
    <div className={classNames}>
      <div className="chat-container__drag-region" data-tauri-drag-region />
      {!sidebarVisible && (
        <div className="chat-container__header">
          <IconButton
            icon={<SidebarLeftIcon size={18} />}
            onClick={onSidebarToggle}
            aria-label="显示侧边栏"
            size="sm"
            variant="ghost"
          />
        </div>
      )}
      {sidebarVisible && (
        <div className="chat-container__sidebar">
          <Sidebar
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSessionSelect={onSessionSelect}
            onNewChat={onNewChat}
            onSplitViewClick={onSidebarToggle}
            onSessionDelete={onSessionDelete}
            onSessionRename={onSessionRename}
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
          />
        </div>
      )}

      <div className="chat-container__main">
        <div className="chat-container__session-header">
          <div className="chat-container__session-title">{displayTitle ?? '新对话'}</div>
          <div className="chat-container__session-meta">
            <div className="chat-container__meta-item chat-container__meta-item--cwd">
              <FolderIcon size={14} />
              <span className="chat-container__meta-label">目录</span>
              <span className="chat-container__meta-value" title={displayCwd}>
                {displayCwd}
              </span>
              {onSelectCwd && (
                <button
                  type="button"
                  className="chat-container__meta-action"
                  onClick={onSelectCwd}
                >
                  更改
                </button>
              )}
            </div>
          </div>
          {sessionNotice && (
            <div
              className={`chat-container__session-notice chat-container__session-notice--${sessionNotice.kind}`}
            >
              {sessionNotice.message}
            </div>
          )}
        </div>
        {showWelcome ? (
          <div className="chat-container__welcome">
            {welcomeContent}
          </div>
        ) : (
          <div className="chat-container__messages">
            <ChatMessageList messages={messages} approvals={approvals} />
          </div>
        )}

        <div className="chat-container__input-wrapper">
          <ChatInput
            value={inputValue}
            onChange={onInputChange}
            onSend={handleSend}
            disabled={isGenerating}
            placeholder={inputPlaceholder}
            selectedAgent={selectedAgent}
            onAgentChange={setSelectedAgent}
            selectedModel={selectedModel}
            modelOptions={modelOptions}
            onModelChange={onModelChange}
            slashCommands={slashCommands}
            className="chat-container__input"
          />
        </div>

      </div>
    </div>
  );
}

export type { ChatContainerProps } from './types';
