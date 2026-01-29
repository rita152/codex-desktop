import { lazy, memo, Suspense, useRef, useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { Sidebar } from '../Sidebar';
import { ChatMessageList } from '../ChatMessageList';
import { ChatInput } from '../ChatInput';
import { ChatSideActions } from '../ChatSideActions';
import { IconButton } from '../../ui/data-entry/IconButton';
import { SidebarRightIcon } from '../../ui/data-display/Icon';
import { Plan } from '../../ui/data-display/Plan';
import { cn } from '../../../utils/cn';

import type { ChatContainerProps } from './types';
import { UnifiedSidePanel, SidePanelTab } from '../UnifiedSidePanel';
import { DirectorySelector } from './DirectorySelector';

import './ChatContainer.css';

const DEFAULT_SIDEBAR_WIDTH = 200;

const QueueIndicator = lazy(() =>
  import('../QueueIndicator').then((module) => ({ default: module.QueueIndicator }))
);

export const ChatContainer = memo(function ChatContainer({
  sessions,
  selectedSessionId,
  sessionCwd,
  sessionNotice,
  messages,
  approvals,
  isGenerating = false,
  currentPlan,
  messageQueue = [],
  hasQueuedMessages = false,
  onClearQueue,
  onRemoveFromQueue,
  onMoveToTopInQueue,
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
  onEditInQueue,
  /* Unified Panel Props */
  sidePanelVisible = false,
  activeSidePanelTab = 'explorer',
  sidePanelWidth = 360,
  onSidePanelClose,
  onSidePanelResizeStart,
  onSidePanelTabChange,

  /* Legacy Panel Props (To be safe or if passed by parent for other reasons) */
  terminalId,

  onFileSelect,

  onSessionSelect,
  onNewChat,
  onSendMessage,
  onPickLocalCwd,
  onSetCwd,
  cwdLocked = false,
  onSessionDelete,
  onSessionRename,
  sidebarVisible = true,
  onSidebarToggle,
  onSettingsClick,
  welcomeContent,
  bodyRef: bodyRefProp,
  className = '',
  onNavigatePreviousPrompt,
  onNavigateNextPrompt,
  onResetPromptNavigation,
}: ChatContainerProps) {
  const { t } = useTranslation();
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  // Delay enabling sidebar transition to prevent first-interaction flicker in Tauri WebView
  const [sidebarTransitionReady, setSidebarTransitionReady] = useState(false);
  // Remove local state for terminal width since it's unified now
  const internalBodyRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = bodyRefProp ?? internalBodyRef;

  // Enable sidebar transition after initial render to prevent flicker
  useEffect(() => {
    // Use double RAF to ensure the browser has completed initial layout
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        setSidebarTransitionReady(true);
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  const handleSend = (message: string) => {
    onSendMessage?.(message);
    onInputChange('');
  };

  const classNames = cn('chat-container', className);

  const showWelcome = messages.length === 0 && (!approvals || approvals.length === 0);
  const displayCwd = sessionCwd && sessionCwd.trim() !== '' ? sessionCwd : t('chat.defaultCwd');

  return (
    <div className={classNames}>
      {!sidebarVisible && onSidebarToggle && (
        <div className="chat-container__header">
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
          sidebarTransitionReady && 'chat-container__sidebar--ready',
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
          onSettingsClick={onSettingsClick}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
        />
      </div>

      <div
        className={cn(
          'chat-container__main',
          sidePanelVisible && 'chat-container__main--side-panel-open'
        )}
        style={
          {
            ...(sidePanelVisible && { '--side-panel-width': `${sidePanelWidth}px` }),
          } as CSSProperties
        }
      >
        <ChatSideActions
          onAction={onSideAction}
          className={sidePanelVisible ? 'chat-side-actions--hidden' : ''}
        />
        <div
          className={cn(
            'chat-container__body',
            sidePanelVisible && 'chat-container__body--side-panel-open'
          )}
          ref={bodyRef}
        >
          <div className="chat-container__conversation">
            <div className="chat-container__session-header">
              <div className="chat-container__session-meta">
                <div className="chat-container__drag-spacer" data-tauri-drag-region />
                <DirectorySelector
                  currentCwd={displayCwd}
                  cwdLocked={cwdLocked}
                  onPickLocalCwd={onPickLocalCwd || (() => {})}
                  onCwdSelect={onSetCwd || (() => {})}
                />
                <div className="chat-container__drag-spacer" data-tauri-drag-region />
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
              {hasQueuedMessages && (
                <Suspense fallback={null}>
                  <QueueIndicator
                    queue={messageQueue}
                    onRemove={onRemoveFromQueue}
                    onMoveToTop={onMoveToTopInQueue}
                    onEdit={onEditInQueue}
                    onClearAll={onClearQueue}
                    className="chat-container__queue-indicator"
                  />
                </Suspense>
              )}
              {currentPlan && currentPlan.length > 0 && (
                <Plan
                  steps={currentPlan}
                  title={t('chat.planTitle')}
                  className="chat-container__plan"
                />
              )}
              <ChatInput
                value={inputValue}
                onChange={onInputChange}
                onSend={handleSend}
                disabled={false}
                placeholder={inputPlaceholder}
                onAddClick={onAddClick}
                selectedAgent={selectedAgent}
                agentOptions={agentOptions}
                onAgentChange={onAgentChange}
                selectedModel={selectedModel}
                modelOptions={modelOptions}
                onModelChange={onModelChange}
                slashCommands={slashCommands}
                className="chat-container__input"
                onNavigatePrevious={onNavigatePreviousPrompt}
                onNavigateNext={onNavigateNextPrompt}
                onResetNavigation={onResetPromptNavigation}
              />
            </div>
          </div>
        </div>
      </div>
      <div
        className={cn(
          'chat-container__side-panel',
          sidebarTransitionReady && 'chat-container__side-panel--ready'
        )}
        style={{
          width: sidePanelWidth,
          marginRight: sidePanelVisible ? 0 : -sidePanelWidth,
          opacity: sidePanelVisible ? 1 : 0,
        }}
        aria-hidden={!sidePanelVisible}
      >
        {onSidePanelClose && onSidePanelTabChange && onSidePanelResizeStart && (
          <UnifiedSidePanel
            activeTab={activeSidePanelTab as SidePanelTab}
            onTabChange={onSidePanelTabChange}
            onClose={onSidePanelClose}
            width={sidePanelWidth}
            onResizeStart={onSidePanelResizeStart}
            terminalId={terminalId || null}
            sessionCwd={sessionCwd || ''}
            onFileSelect={onFileSelect || (() => {})}
          />
        )}
      </div>
    </div>
  );
});

ChatContainer.displayName = 'ChatContainer';

export type { ChatContainerProps } from './types';
