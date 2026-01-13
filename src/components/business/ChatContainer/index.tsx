import { useState } from 'react';

import { Sidebar } from '../Sidebar';
import { ChatMessageList } from '../ChatMessageList';
import { ChatInput } from '../ChatInput';
import { IconButton } from '../../ui/data-entry/IconButton';
import { SidebarLeftIcon } from '../../ui/data-display/Icon';
import { Approval } from '../../ui/feedback/Approval';
import { cn } from '../../../utils/cn';

import type { ChatContainerProps } from './types';

import './ChatContainer.css';

const DEFAULT_SIDEBAR_WIDTH = 260;

export function ChatContainer({
  sessions,
  selectedSessionId,
  messages,
  approvals,
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

  const showWelcome = messages.length === 0;

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

        {approvals && approvals.length > 0 && (
          <div className="chat-container__approvals" aria-live="polite">
            {approvals.map((approval) => (
              <Approval key={approval.callId} {...approval} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type { ChatContainerProps } from './types';
