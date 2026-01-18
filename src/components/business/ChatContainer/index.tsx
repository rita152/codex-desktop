import { lazy, Suspense, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { Sidebar } from '../Sidebar';
import { ChatMessageList } from '../ChatMessageList';
import { ChatInput } from '../ChatInput';
import { ChatSideActions } from '../ChatSideActions';
import { IconButton } from '../../ui/data-entry/IconButton';
import { FolderIcon, SidebarRightIcon } from '../../ui/data-display/Icon';
import { cn } from '../../../utils/cn';
import { usePanelResize } from '../../../hooks/usePanelResize';

import type { ChatContainerProps } from './types';

import './ChatContainer.css';

const DEFAULT_SIDEBAR_WIDTH = 200;
const DEFAULT_TERMINAL_WIDTH = 360;
const MIN_TERMINAL_WIDTH = 240;
const MIN_CONVERSATION_WIDTH = 240;

const TerminalPanel = lazy(() =>
  import('../TerminalPanel').then((module) => ({ default: module.TerminalPanel }))
);

const RemoteServerPanel = lazy(() =>
  import('../RemoteServerPanel').then((module) => ({ default: module.RemoteServerPanel }))
);

const SidePanelFallback = ({
  visible = false,
  className,
  widthVar,
}: {
  visible?: boolean;
  className: string;
  widthVar: string;
}) => {
  const panelStyle: CSSProperties = visible
    ? {
      flex: `0 0 var(${widthVar}, 360px)`,
      minHeight: 0,
      alignSelf: 'stretch',
    }
    : { flex: '0 0 0', width: 0, minHeight: 0 };

  return (
    <aside className={className} aria-hidden={!visible} style={panelStyle}>
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
  remoteServerPanelVisible = false,
  remoteServerPanelWidth = 360,
  onRemoteServerPanelClose,
  onRemoteServerPanelResizeStart,
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
  bodyRef: bodyRefProp,
  className = '',
}: ChatContainerProps) {
  const { t } = useTranslation();
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [terminalWidth, setTerminalWidth] = useState(DEFAULT_TERMINAL_WIDTH);
  const internalBodyRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = bodyRefProp ?? internalBodyRef;

  const handleSend = (message: string) => {
    onSendMessage?.(message);
    onInputChange('');
  };

  const classNames = cn('chat-container', className);

  const showWelcome = messages.length === 0 && (!approvals || approvals.length === 0);
  const displayCwd = sessionCwd && sessionCwd.trim() !== '' ? sessionCwd : t('chat.defaultCwd');

  const handleTerminalResize = usePanelResize({
    isOpen: terminalVisible,
    width: terminalWidth,
    setWidth: setTerminalWidth,
    minWidth: MIN_TERMINAL_WIDTH,
    minContentWidth: MIN_CONVERSATION_WIDTH,
    getContainerWidth: () => bodyRef.current?.getBoundingClientRect().width ?? 0,
  });

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
          terminalVisible && 'chat-container__main--terminal-open',
          remoteServerPanelVisible && 'chat-container__main--remote-open'
        )}
        style={{
          ...(terminalVisible && { '--terminal-panel-width': `${terminalWidth}px` }),
          ...(remoteServerPanelVisible && { '--remote-server-panel-width': `${remoteServerPanelWidth}px` }),
        } as CSSProperties}
      >
        {!terminalVisible && !remoteServerPanelVisible && <ChatSideActions onAction={onSideAction} />}
        <div
          className={cn(
            'chat-container__body',
            terminalVisible && 'chat-container__body--terminal-open',
            remoteServerPanelVisible && 'chat-container__body--remote-open'
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
                  <FolderIcon size={12} />
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
            <Suspense
              fallback={
                <SidePanelFallback
                  visible={terminalVisible}
                  className="terminal-panel"
                  widthVar="--terminal-panel-width"
                />
              }
            >
              <TerminalPanel
                terminalId={terminalId}
                visible={terminalVisible}
                onClose={onTerminalClose}
                onResizeStart={handleTerminalResize}
              />
            </Suspense>
          )}
          {remoteServerPanelVisible && (
            <Suspense
              fallback={
                <SidePanelFallback
                  visible={remoteServerPanelVisible}
                  className="remote-server-panel"
                  widthVar="--remote-server-panel-width"
                />
              }
            >
              <RemoteServerPanel
                visible={remoteServerPanelVisible}
                onClose={onRemoteServerPanelClose}
                onResizeStart={onRemoteServerPanelResizeStart}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

export type { ChatContainerProps } from './types';
