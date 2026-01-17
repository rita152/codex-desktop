import { lazy, Suspense, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Sidebar } from '../Sidebar';
import { ChatMessageList } from '../ChatMessageList';
import { ChatInput } from '../ChatInput';
import { ChatSideActions } from '../ChatSideActions';
import { IconButton } from '../../ui/data-entry/IconButton';
import { FolderIcon, SidebarRightIcon } from '../../ui/data-display/Icon';
import { cn } from '../../../utils/cn';

import type { ChatContainerProps } from './types';

import './ChatContainer.css';

const DEFAULT_SIDEBAR_WIDTH = 200;
const DEFAULT_TERMINAL_WIDTH = 360;
const MIN_TERMINAL_WIDTH = 240;
const MIN_CONVERSATION_WIDTH = 240;

const TerminalPanel = lazy(() =>
  import('../TerminalPanel').then((module) => ({ default: module.TerminalPanel }))
);

const TerminalPanelFallback = ({ visible = false }: { visible?: boolean }) => {
  const panelStyle: CSSProperties = visible
    ? {
        flex: '0 0 var(--terminal-panel-width, 360px)',
        minHeight: 0,
        alignSelf: 'stretch',
      }
    : { flex: '0 0 0', width: 0, minHeight: 0 };

  return (
    <aside className="terminal-panel" aria-hidden={!visible} style={panelStyle}>
      {visible && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: '0.85rem',
          }}
        >
          Loading...
        </div>
      )}
    </aside>
  );
};

export function ChatContainer({
  sessions,
  selectedSessionId,
  sessionCwd,
  sessionNotice,
  messages,
  approvals,
  isGenerating = false,
  inputValue,
  onInputChange,
  agentOptions,
  selectedAgent,
  onAgentChange,
  modelOptions,
  selectedModel,
  onModelChange,
  slashCommands,
  inputPlaceholder,
  onAddClick,
  onSideAction,
  terminalVisible = false,
  terminalId,
  onTerminalClose,
  onSessionSelect,
  onNewChat,
  onSendMessage,
  onSelectCwd,
  cwdLocked = false,
  onSessionDelete,
  onSessionRename,
  sidebarVisible = true,
  onSidebarToggle,
  remainingPercent = 0,
  remainingTokens,
  totalTokens,
  onRemainingClick,
  remainingDisabled = false,
  welcomeContent,
  className = '',
}: ChatContainerProps) {
  const { t } = useTranslation();
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [terminalWidth, setTerminalWidth] = useState(DEFAULT_TERMINAL_WIDTH);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const handleSend = (message: string) => {
    onSendMessage?.(message);
    onInputChange('');
  };

  const classNames = cn('chat-container', className);

  const showWelcome = messages.length === 0 && (!approvals || approvals.length === 0);
  const displayCwd = sessionCwd && sessionCwd.trim() !== '' ? sessionCwd : t('chat.defaultCwd');

  const clampTerminalWidth = (nextWidth: number) => {
    const bodyWidth = bodyRef.current?.getBoundingClientRect().width ?? 0;
    const maxWidth = bodyWidth
      ? Math.max(MIN_TERMINAL_WIDTH, bodyWidth - MIN_CONVERSATION_WIDTH)
      : nextWidth;
    return Math.min(Math.max(nextWidth, MIN_TERMINAL_WIDTH), maxWidth);
  };

  const handleTerminalResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!terminalVisible) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = terminalWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = startX - moveEvent.clientX;
      setTerminalWidth(clampTerminalWidth(startWidth + delta));
    };
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className={classNames}>
      <div className="chat-container__drag-region" data-tauri-drag-region />
      {!sidebarVisible && onSidebarToggle && (
        <div className="chat-container__header" data-tauri-drag-region>
          <IconButton
            icon={<SidebarRightIcon size={18} />}
            onClick={onSidebarToggle}
            aria-label={t('sidebar.show')}
            size="sm"
            variant="ghost"
          />
        </div>
      )}
      <div
        className={cn(
          'chat-container__sidebar',
          !sidebarVisible && 'chat-container__sidebar--hidden'
        )}
        style={{
          width: sidebarWidth,
          marginLeft: sidebarVisible ? 0 : -sidebarWidth,
        }}
        aria-hidden={!sidebarVisible}
      >
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

      <div
        className={cn(
          'chat-container__main',
          terminalVisible && 'chat-container__main--terminal-open'
        )}
        style={
          terminalVisible
            ? ({ '--terminal-panel-width': `${terminalWidth}px` } as CSSProperties)
            : undefined
        }
      >
        {!terminalVisible && <ChatSideActions onAction={onSideAction} />}
        <div
          className={cn(
            'chat-container__body',
            terminalVisible && 'chat-container__body--terminal-open'
          )}
          ref={bodyRef}
        >
          <div className="chat-container__conversation">
            <div className="chat-container__session-header" data-tauri-drag-region>
              <div className="chat-container__session-meta">
                <button
                  type="button"
                  className="chat-container__cwd-button"
                  onClick={onSelectCwd}
                  disabled={!onSelectCwd || cwdLocked}
                  title={cwdLocked ? t('chat.cwdLocked') : displayCwd}
                >
                  <FolderIcon size={14} />
                  <span className="chat-container__meta-value">{displayCwd}</span>
                </button>
              </div>
              {sessionNotice && (
                <div
                  className={cn(
                    'chat-container__session-notice',
                    `chat-container__session-notice--${sessionNotice.kind}`
                  )}
                >
                  {sessionNotice.message}
                </div>
              )}
            </div>
            {showWelcome ? (
              <div className="chat-container__welcome">{welcomeContent}</div>
            ) : (
              <div className="chat-container__messages">
                <ChatMessageList
                  messages={messages}
                  approvals={approvals}
                  isGenerating={isGenerating}
                />
              </div>
            )}
            <div className="chat-container__input-wrapper">
              <ChatInput
                value={inputValue}
                onChange={onInputChange}
                onSend={handleSend}
                disabled={isGenerating}
                placeholder={inputPlaceholder}
                onAddClick={onAddClick}
                selectedAgent={selectedAgent}
                agentOptions={agentOptions}
                onAgentChange={onAgentChange}
                selectedModel={selectedModel}
                modelOptions={modelOptions}
                onModelChange={onModelChange}
                slashCommands={slashCommands}
                remainingPercent={remainingPercent}
                remainingTokens={remainingTokens}
                totalTokens={totalTokens}
                onRemainingClick={onRemainingClick}
                remainingDisabled={remainingDisabled}
                className="chat-container__input"
              />
            </div>
          </div>
          {(terminalVisible || terminalId) && (
            <Suspense fallback={<TerminalPanelFallback visible={terminalVisible} />}>
              <TerminalPanel
                terminalId={terminalId}
                visible={terminalVisible}
                onClose={onTerminalClose}
                onResizeStart={handleTerminalResize}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

export type { ChatContainerProps } from './types';
