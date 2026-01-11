import { useState } from 'react';

import { Sidebar } from '../Sidebar';
import { ChatMessageList } from '../ChatMessageList';
import { ChatInput } from '../ChatInput';
import { IconButton } from '../../ui/data-entry/IconButton';
import { SidebarLeftIcon } from '../../ui/data-display/Icon';

import type { ChatContainerProps } from './types';

import './ChatContainer.css';

export function ChatContainer({
  sessions,
  selectedSessionId,
  messages,
  isGenerating = false,
  onSessionSelect,
  onNewChat,
  onSendMessage,
  sidebarVisible = true,
  onSidebarToggle,
  welcomeContent,
  className = '',
}: ChatContainerProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSend = (message: string) => {
    onSendMessage?.(message);
    setInputValue('');
  };

  const classNames = ['chat-container', className].filter(Boolean).join(' ');

  const sidebarClassNames = [
    'chat-container__sidebar',
    !sidebarVisible && 'chat-container__sidebar--hidden',
  ]
    .filter(Boolean)
    .join(' ');

  const showWelcome = messages.length === 0;

  return (
    <div className={classNames}>
      <div className={sidebarClassNames}>
        <Sidebar
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSessionSelect={onSessionSelect}
          onNewChat={onNewChat}
          onSplitViewClick={onSidebarToggle}
        />
      </div>

      <div className="chat-container__main">
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

        {showWelcome ? (
          <div className="chat-container__welcome">
            {welcomeContent ?? (
              <>
                <h1 className="chat-container__welcome-title">开始新的对话</h1>
                <p className="chat-container__welcome-subtitle">
                  输入消息开始与 AI 对话
                </p>
              </>
            )}
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
            className="chat-container__input"
          />
        </div>
      </div>
    </div>
  );
}

export type { ChatContainerProps } from './types';
