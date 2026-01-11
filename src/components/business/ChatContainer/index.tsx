import { useState } from 'react';

import { Sidebar } from '../Sidebar';
import { ChatMessageList } from '../ChatMessageList';
import { ChatInput } from '../ChatInput';
import { IconButton } from '../../ui/data-entry/IconButton';
import { SidebarLeftIcon } from '../../ui/data-display/Icon';
import { cn } from '../../../utils/cn';

import type { ChatContainerProps } from './types';

import './ChatContainer.css';

const DEFAULT_SIDEBAR_WIDTH = 260;

export function ChatContainer({
  sessions,
  selectedSessionId,
  messages,
  isGenerating = false,
  onSessionSelect,
  onNewChat,
  onSendMessage,
  onSessionDelete,
  onSessionRename,
  sidebarVisible = true,
  onSidebarToggle,
  welcomeContent,
  className = '',
}: ChatContainerProps) {
  const [inputValue, setInputValue] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [selectedAgent, setSelectedAgent] = useState('agent-full');
  const [selectedModel, setSelectedModel] = useState('gpt-5.2-high');

  const handleSend = (message: string) => {
    onSendMessage?.(message);
    setInputValue('');
  };

  const classNames = cn('chat-container', className);

  const sidebarClassNames = cn(
    'chat-container__sidebar',
    !sidebarVisible && 'chat-container__sidebar--hidden'
  );

  const showWelcome = messages.length === 0;

  // 动态计算 sidebar 容器的样式，收起时使用实际宽度
  const sidebarStyle = !sidebarVisible
    ? { marginLeft: `-${sidebarWidth}px` }
    : undefined;

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
      <div className={sidebarClassNames} style={sidebarStyle}>
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

      <div className="chat-container__main">
        {showWelcome ? (
          <div className="chat-container__welcome">
            {welcomeContent}
          </div>
        ) : (
          <div className="chat-container__messages">
            <ChatMessageList messages={messages} />
          </div>
        )}

        <div className="chat-container__input-wrapper">
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            disabled={isGenerating}
            selectedAgent={selectedAgent}
            onAgentChange={setSelectedAgent}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            className="chat-container__input"
          />
        </div>
      </div>
    </div>
  );
}

export type { ChatContainerProps } from './types';
