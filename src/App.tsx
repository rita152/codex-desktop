import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';

import { ChatContainer } from './components/business/ChatContainer';
import { SettingsModal } from './components/business/SettingsModal';
import { initCodex, sendPrompt, setSessionMode, setSessionModel } from './api/codex';
import {
  loadModeOptionsCache,
  loadModelOptionsCache,
  saveModeOptionsCache,
  saveModelOptionsCache,
} from './api/storage';
import { useApprovalCards } from './hooks/useApprovalCards';
import { useApprovalState } from './hooks/useApprovalState';
import { useCodexSessionSync } from './hooks/useCodexSessionSync';
import { usePanelResize } from './hooks/usePanelResize';
import { useResponsiveSidebar } from './hooks/useResponsiveSidebar';
import { useRemoteCwdPicker } from './hooks/useRemoteCwdPicker';


import { useSelectOptionsCache } from './hooks/useSelectOptionsCache';
import { useSessionMeta } from './hooks/useSessionMeta';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useSessionViewState } from './hooks/useSessionViewState';
import { useTerminalLifecycle } from './hooks/useTerminalLifecycle';
import { useMessageQueue } from './hooks/useMessageQueue';
import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID, DEFAULT_SLASH_COMMANDS } from './constants/chat';
import { formatError, newMessageId } from './utils/codexParsing';
import { isRemotePath } from './utils/remotePath';
import { resolveOptionId } from './utils/optionSelection';
import { devDebug } from './utils/logger';
import { terminalKill } from './api/terminal';

import type { Message } from './components/business/ChatMessageList/types';
import type { ChatSession } from './components/business/Sidebar/types';
import type { SelectOption } from './components/ui/data-entry/Select/types';
import type { SidePanelTab } from './components/business/UnifiedSidePanel';
import './App.css';

const SIDEBAR_AUTO_HIDE_MAX_WIDTH = 900;
const DEFAULT_SIDE_PANEL_WIDTH = 360;
const MIN_SIDE_PANEL_WIDTH = 260;

export function App() {
  const { t } = useTranslation();
  const {
    sessions,
    setSessions,
    selectedSessionId,
    setSelectedSessionId,
    sessionMessages,
    setSessionMessages,
    sessionDrafts,
    setSessionDrafts,
  } = useSessionPersistence();

  const {
    sessionNotices,
    sessionSlashCommands,
    sessionModelOptions,
    sessionModeOptions,
    setSessionNotices,
    setSessionSlashCommands,
    setSessionModelOptions,
    setSessionModeOptions,
    clearSessionNotice,
    removeSessionMeta,
  } = useSessionMeta();
  const { cache: modelCache, applyOptions: applyModelOptions } = useSelectOptionsCache({
    sessions,
    defaultId: DEFAULT_MODEL_ID,
    loadCache: () => {
      const cached = loadModelOptionsCache();
      return cached ? { options: cached.options, currentId: cached.currentModelId } : null;
    },
    saveCache: ({ options, currentId }) =>
      saveModelOptionsCache({ options, currentModelId: currentId }),
    setSessionOptions: setSessionModelOptions,
  });
  const { applyOptions: applyModeOptions } = useSelectOptionsCache({
    sessions,
    defaultId: DEFAULT_MODE_ID,
    loadCache: () => {
      const cached = loadModeOptionsCache();
      return cached ? { options: cached.options, currentId: cached.currentModeId } : null;
    },
    saveCache: ({ options, currentId }) =>
      saveModeOptionsCache({ options, currentModeId: currentId }),
    setSessionOptions: setSessionModeOptions,
  });

  const { sidebarVisible, isNarrowLayout, toggleSidebar } = useResponsiveSidebar(
    SIDEBAR_AUTO_HIDE_MAX_WIDTH
  );
  const pickRemoteCwd = useRemoteCwdPicker();
  const [terminalVisible, setTerminalVisible] = useState(false); // Kept for terminal lifecycle hooks for now, but synced with sidePanel
  const [terminalBySession, setTerminalBySession] = useState<Record<string, string>>({});
  const [isGeneratingBySession, setIsGeneratingBySession] = useState<Record<string, boolean>>({});

  // Unified Side Panel State
  const [sidePanelVisible, setSidePanelVisible] = useState(false);
  const [activeSidePanelTab, setActiveSidePanelTab] = useState<SidePanelTab>('explorer');
  const [sidePanelWidth, setSidePanelWidth] = useState(DEFAULT_SIDE_PANEL_WIDTH);
  const {
    pendingApprovals,
    approvalStatuses,
    approvalLoading,
    setApprovalStatuses,
    setApprovalLoading,
    registerApprovalRequest,
    clearApproval,
  } = useApprovalState();

  const activeSessionIdRef = useRef<string>(selectedSessionId);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // We can keep these hooks if they provide other utility, but we will ignore their visibility state for UI rendering
  // Ideally we should refactor them later to remove the UI state from them entirely if unused.
  // For now, let's just use usePanelResize for the unified panel directly.

  const handleSidePanelResize = usePanelResize({
    isOpen: sidePanelVisible,
    width: sidePanelWidth,
    setWidth: setSidePanelWidth,
    minWidth: MIN_SIDE_PANEL_WIDTH,
    minContentWidth: 240, // MIN_CONVERSATION_WIDTH
    getContainerWidth: () => bodyRef.current?.getBoundingClientRect().width ?? 0,
  });

  const { clearCodexSession, ensureCodexSession, getCodexSessionId, resolveChatSessionId } =
    useCodexSessionSync({
      sessions,
      activeSessionIdRef,
      setSessions,
      setSessionMessages,
      setIsGeneratingBySession,
      setSessionSlashCommands,
      setSessionModeOptions,
      setSessionModelOptions,
      setSessionNotices,
      clearSessionNotice,
      applyModeOptions,
      applyModelOptions,
      registerApprovalRequest,
      defaultModeId: DEFAULT_MODE_ID,
      defaultModelId: DEFAULT_MODEL_ID,
      t,
    });

  useEffect(() => {
    activeSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  const {
    activeSession,
    messages,
    draftMessage,
    selectedModel,
    selectedMode,
    selectedCwd,
    sessionNotice,
    agentOptions,
    modelOptions,
    slashCommands,
    isGenerating,
    cwdLocked,
    activeTerminalId,
  } = useSessionViewState({
    sessions,
    selectedSessionId,
    sessionMessages,
    sessionDrafts,
    sessionNotices,
    sessionModeOptions,
    sessionModelOptions,
    sessionSlashCommands,
    modelCache,
    isGeneratingBySession,
    terminalBySession,
    defaultModelId: DEFAULT_MODEL_ID,
    defaultModeId: DEFAULT_MODE_ID,
    defaultSlashCommands: DEFAULT_SLASH_COMMANDS,
  });

  useTerminalLifecycle({
    terminalVisible: sidePanelVisible && activeSidePanelTab === 'terminal', // Sync lifecycle with unified state
    selectedSessionId,
    activeTerminalId,
    selectedCwd,
    setTerminalBySession,
    setTerminalVisible: (visible) => {
      // If the lifecycle wants to close the terminal, we close the panel if it's the terminal tab
      if (!visible && activeSidePanelTab === 'terminal') {
        setSidePanelVisible(false);
      }
      // If it wants to open, we open the panel
      if (visible) {
        setSidePanelVisible(true);
        setActiveSidePanelTab('terminal');
      }
    },
    setSessionNotices,
    t,
  });

  useEffect(() => {
    if (!modelOptions || modelOptions.length === 0) return;
    const available = new Set(modelOptions.map((option) => option.value));
    if (available.has(selectedModel)) return;

    const preferred = resolveOptionId({
      availableOptions: modelOptions,
      fallbackIds: [DEFAULT_MODEL_ID, modelCache.currentId],
      defaultId: DEFAULT_MODEL_ID,
    });

    if (!preferred || preferred === selectedModel) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === selectedSessionId ? { ...session, model: preferred } : session
      )
    );
  }, [modelCache.currentId, modelOptions, selectedModel, selectedSessionId, setSessions]);

  useEffect(() => {
    if (!agentOptions || agentOptions.length === 0) return;
    const available = new Set(agentOptions.map((option) => option.value));
    if (available.has(selectedMode)) return;

    const preferred = resolveOptionId({
      availableOptions: agentOptions,
      fallbackIds: [DEFAULT_MODE_ID],
      defaultId: DEFAULT_MODE_ID,
    });

    if (!preferred || preferred === selectedMode) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === selectedSessionId ? { ...session, mode: preferred } : session
      )
    );
  }, [agentOptions, selectedMode, selectedSessionId, setSessions]);

  const pickFiles = useCallback(async (): Promise<string[]> => {
    try {
      const selection = await open({
        directory: false,
        multiple: true,
      });
      if (typeof selection === 'string') return [selection];
      if (Array.isArray(selection)) {
        return selection.filter((item): item is string => typeof item === 'string');
      }
      return [];
    } catch (err) {
      devDebug('[codex] Failed to open file picker', err);
      return [];
    }
  }, []);

  const handleDraftChange = useCallback(
    (value: string) => {
      setSessionDrafts((prev) => ({ ...prev, [selectedSessionId]: value }));
    },
    [selectedSessionId, setSessionDrafts]
  );

  useEffect(() => {
    void initCodex().catch((err) => {
      devDebug('[codex] init failed', err);
    });
  }, []);

  const handleModelOptionsFetched = useCallback(
    ({ options, currentId }: { options: SelectOption[]; currentId?: string }) => {
      applyModelOptions({
        options,
        currentId,
        fallbackCurrentId: DEFAULT_MODEL_ID,
      });
    },
    [applyModelOptions]
  );

  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleCwdSelect = useCallback(
    (cwd: string) => {
      const sessionId = selectedSessionId;
      if (!sessionId) return;
      setSessions((prev) =>
        prev.map((session) => (session.id === sessionId ? { ...session, cwd } : session))
      );
      clearSessionNotice(sessionId);
    },
    [clearSessionNotice, selectedSessionId, setSessions]
  );

  const handleNewChat = useCallback(() => {
    // 直接在当前工作目录下新建对话，不打开文件选择器
    // 如果需要切换工作目录，用户应使用顶部的文件夹按钮
    const newId = String(Date.now());
    const newSession: ChatSession = {
      id: newId,
      title: t('chat.newSessionTitle'),
      cwd: selectedCwd, // 继承当前会话的工作目录
      model: DEFAULT_MODEL_ID,
      mode: DEFAULT_MODE_ID,
    };
    setSessions((prev) => [newSession, ...prev]);
    setSessionMessages((prev) => ({ ...prev, [newId]: [] }));
    setSessionDrafts((prev) => ({ ...prev, [newId]: '' }));
    setIsGeneratingBySession((prev) => ({ ...prev, [newId]: false }));
    setSelectedSessionId(newId);
    clearSessionNotice(newId);
    activeSessionIdRef.current = newId;
  }, [
    clearSessionNotice,
    selectedCwd,
    setSelectedSessionId,
    setSessionDrafts,
    setSessionMessages,
    setSessions,
    t,
  ]);

  const handleSessionSelect = useCallback(
    (sessionId: string) => {
      setSelectedSessionId(sessionId);
      activeSessionIdRef.current = sessionId;
    },
    [setSelectedSessionId]
  );

  const handleSessionDelete = useCallback(
    (sessionId: string) => {
      const shouldCreateNew = sessions.length <= 1;
      const sessionMeta = sessions.find((session) => session.id === sessionId);
      const newSessionId = String(Date.now());
      const newSession: ChatSession = {
        id: newSessionId,
        title: t('chat.newSessionTitle'),
        cwd: sessionMeta?.cwd ?? selectedCwd,
        model: DEFAULT_MODEL_ID,
        mode: DEFAULT_MODE_ID,
      };

      clearCodexSession(sessionId);
      const terminalId = terminalBySession[sessionId];
      if (terminalId) {
        void terminalKill(terminalId);
        setTerminalBySession((prev) => {
          const next = { ...prev };
          delete next[sessionId];
          return next;
        });
      }
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== sessionId);
        return shouldCreateNew ? [newSession] : next;
      });
      setSessionMessages((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        if (shouldCreateNew) {
          next[newSessionId] = [];
        }
        return next;
      });
      setIsGeneratingBySession((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        if (shouldCreateNew) {
          next[newSessionId] = false;
        }
        return next;
      });
      setSessionDrafts((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        if (shouldCreateNew) {
          next[newSessionId] = '';
        }
        return next;
      });
      removeSessionMeta(sessionId, shouldCreateNew ? newSessionId : undefined);

      // 如果删除的是当前选中的会话，切换到第一个会话
      if (sessionId === selectedSessionId) {
        if (shouldCreateNew) {
          setSelectedSessionId(newSessionId);
          clearSessionNotice(newSessionId);
          activeSessionIdRef.current = newSessionId;
        } else {
          const remaining = sessions.filter((s) => s.id !== sessionId);
          if (remaining.length > 0) {
            setSelectedSessionId(remaining[0].id);
          }
        }
      }
    },
    [
      clearCodexSession,
      clearSessionNotice,
      removeSessionMeta,
      selectedCwd,
      sessions,
      selectedSessionId,
      setSelectedSessionId,
      setSessionDrafts,
      setSessionMessages,
      setSessions,
      terminalBySession,
      t,
    ]
  );

  const handleSessionRename = useCallback(
    (sessionId: string, newTitle: string) => {
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s)));
    },
    [setSessions]
  );

  const handleSettingsClick = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleModelChange = useCallback(
    async (modelId: string) => {
      const sessionId = selectedSessionId;
      const previousModel = activeSession?.model ?? DEFAULT_MODEL_ID;
      if (modelId === previousModel) return;

      setSessions((prev) =>
        prev.map((session) => (session.id === sessionId ? { ...session, model: modelId } : session))
      );
      clearSessionNotice(sessionId);

      const codexSessionId = getCodexSessionId(sessionId);
      if (!codexSessionId) return;

      try {
        await setSessionModel(codexSessionId, modelId);
      } catch (err) {
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId ? { ...session, model: previousModel } : session
          )
        );
        setSessionNotices((prev) => ({
          ...prev,
          [sessionId]: {
            kind: 'error',
            message: t('errors.modelSwitchFailed', { error: formatError(err) }),
          },
        }));
      }
    },
    [
      activeSession?.model,
      clearSessionNotice,
      getCodexSessionId,
      selectedSessionId,
      setSessionNotices,
      setSessions,
      t,
    ]
  );

  const handleModeChange = useCallback(
    async (modeId: string) => {
      const sessionId = selectedSessionId;
      const previousMode = activeSession?.mode ?? DEFAULT_MODE_ID;
      if (modeId === previousMode) return;

      setSessions((prev) =>
        prev.map((session) => (session.id === sessionId ? { ...session, mode: modeId } : session))
      );
      clearSessionNotice(sessionId);

      const codexSessionId = getCodexSessionId(sessionId);
      if (!codexSessionId) return;

      try {
        await setSessionMode(codexSessionId, modeId);
      } catch (err) {
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId ? { ...session, mode: previousMode } : session
          )
        );
        setSessionNotices((prev) => ({
          ...prev,
          [sessionId]: {
            kind: 'error',
            message: t('errors.modeSwitchFailed', { error: formatError(err) }),
          },
        }));
      }
    },
    [
      activeSession?.mode,
      clearSessionNotice,
      getCodexSessionId,
      selectedSessionId,
      setSessionNotices,
      setSessions,
      t,
    ]
  );

  const handleSelectCwd = useCallback(async () => {
    const sessionId = selectedSessionId;
    if (!sessionId) return;
    try {
      const remoteSelection = await pickRemoteCwd();
      if (remoteSelection) {
        handleCwdSelect(remoteSelection);
        return;
      }
      const selection = await open({
        directory: true,
        multiple: false,
        defaultPath:
          selectedCwd && selectedCwd.trim() !== '' && !isRemotePath(selectedCwd)
            ? selectedCwd
            : undefined,
      });
      const nextCwd =
        typeof selection === 'string'
          ? selection
          : Array.isArray(selection) && typeof selection[0] === 'string'
            ? selection[0]
            : null;
      if (!nextCwd) return;
      handleCwdSelect(nextCwd);
    } catch (err) {
      devDebug('[codex] Failed to select working directory', err);
      setSessionNotices((prev) => ({
        ...prev,
        [sessionId]: {
          kind: 'error',
          message: t('errors.genericError', { error: formatError(err) }),
        },
      }));
    }
  }, [handleCwdSelect, pickRemoteCwd, selectedCwd, selectedSessionId, setSessionNotices, t]);

  const handleAddFile = useCallback(async () => {
    const sessionId = selectedSessionId;
    if (!sessionId) return;
    const files = await pickFiles();
    if (files.length === 0) return;

    setSessionDrafts((prev) => {
      const current = prev[sessionId] ?? '';
      const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
      const nextValue = `${current}${separator}${files
        .map((file) => t('chat.filePrefix', { path: file }))
        .join('\n')}`;
      return { ...prev, [sessionId]: nextValue };
    });
  }, [pickFiles, selectedSessionId, setSessionDrafts, t]);

  const handleSideAction = useCallback(
    (actionId: string) => {
      // Map simple IDs to our strongly typed SidePanelTab
      // 'explorer' | 'git' | 'terminal' | 'remote'
      const tabId = actionId as SidePanelTab;

      if (sidePanelVisible && activeSidePanelTab === tabId) {
        // Toggle off if clicking the same active tab
        setSidePanelVisible(false);
      } else {
        // Switch tab and ensure open
        setActiveSidePanelTab(tabId);
        setSidePanelVisible(true);
      }
    },
    [sidePanelVisible, activeSidePanelTab]
  );

  const handleSidePanelClose = useCallback(() => {
    setSidePanelVisible(false);
  }, []);

  const handleSidePanelTabChange = useCallback((tab: SidePanelTab) => {
    setActiveSidePanelTab(tab);
  }, []);

  const handleFileSelect = useCallback(
    (path: string) => {
      // 当在文件浏览器中选择文件时，相当于添加文件到当前会话的草稿中
      const sessionId = selectedSessionId;
      if (!sessionId) return;

      setSessionDrafts((prev) => {
        const current = prev[sessionId] ?? '';
        const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
        const nextValue = `${current}${separator}${t('chat.filePrefix', { path })}`;
        return { ...prev, [sessionId]: nextValue };
      });
    },
    [selectedSessionId, setSessionDrafts, t]
  );

  const handleTerminalClose = useCallback(() => {
    // When terminal closes via its internal logic (if any)
    if (activeSidePanelTab === 'terminal') {
      setSidePanelVisible(false);
    }

    if (!selectedSessionId || !activeTerminalId) return;
    setTerminalBySession((prev) => {
      const next = { ...prev };
      delete next[selectedSessionId];
      return next;
    });
    void terminalKill(activeTerminalId);
  }, [activeTerminalId, activeSidePanelTab, selectedSessionId]);

  // 实际发送消息到后端的处理函数
  const doSendMessage = useCallback(
    (sessionId: string, content: string) => {
      const now = Date.now();
      const userMessage: Message = {
        id: String(now),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      activeSessionIdRef.current = sessionId;
      setIsGeneratingBySession((prev) => ({ ...prev, [sessionId]: true }));

      setSessionMessages((prev) => {
        const list = prev[sessionId] ?? [];
        return { ...prev, [sessionId]: [...list, userMessage] };
      });

      // 如果是第一条消息，用消息内容更新会话标题
      const sessionMessages_ = sessionMessages[sessionId] ?? [];
      if (sessionMessages_.length === 0) {
        const title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)));
      }

      void (async () => {
        try {
          const codexSessionId = await ensureCodexSession(sessionId);
          await sendPrompt(codexSessionId, content);
        } catch (err) {
          setSessionMessages((prev) => {
            const errMsg: Message = {
              id: newMessageId(),
              role: 'assistant',
              content: t('errors.requestFailed', { error: formatError(err) }),
              isStreaming: false,
              timestamp: new Date(),
            };
            return {
              ...prev,
              [sessionId]: [...(prev[sessionId] ?? []), errMsg],
            };
          });
          setIsGeneratingBySession((prev) => ({ ...prev, [sessionId]: false }));
        }
      })();
    },
    [ensureCodexSession, sessionMessages, setSessions, setSessionMessages, t]
  );

  // 消息队列 Hook
  const {
    currentQueue,
    hasQueuedMessages,
    enqueueMessage,
    clearQueue,
    removeFromQueue,
  } = useMessageQueue({
    selectedSessionId,
    isGeneratingBySession,
    onSendMessage: doSendMessage,
  });

  // 对外暴露的发送消息处理：支持排队
  const handleSendMessage = useCallback(
    (content: string) => {
      enqueueMessage(content);
    },
    [enqueueMessage]
  );

  // 清空当前会话的队列
  const handleClearQueue = useCallback(() => {
    clearQueue(selectedSessionId);
  }, [clearQueue, selectedSessionId]);

  // 从队列中移除消息
  const handleRemoveFromQueue = useCallback(
    (messageId: string) => {
      removeFromQueue(selectedSessionId, messageId);
    },
    [removeFromQueue, selectedSessionId]
  );

  const approvalCards = useApprovalCards({
    pendingApprovals,
    approvalStatuses,
    approvalLoading,
    setApprovalStatuses,
    setApprovalLoading,
    clearApproval,
    resolveChatSessionId,
    selectedSessionId,
    setSessionNotices,
    t,
  });

  return (
    <>
      <ChatContainer
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        sessionCwd={selectedCwd}
        sessionNotice={sessionNotice}
        messages={messages}
        approvals={approvalCards}
        sidebarVisible={sidebarVisible}
        isGenerating={isGenerating}
        messageQueue={currentQueue}
        hasQueuedMessages={hasQueuedMessages}
        onClearQueue={handleClearQueue}
        onRemoveFromQueue={handleRemoveFromQueue}
        inputValue={draftMessage}
        onInputChange={handleDraftChange}
        agentOptions={agentOptions}
        selectedAgent={selectedMode}
        onAgentChange={handleModeChange}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        slashCommands={slashCommands}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
        onSendMessage={handleSendMessage}
        onAddClick={handleAddFile}
        onSideAction={handleSideAction}

        // Unified Side Panel Props
        sidePanelVisible={sidePanelVisible}
        activeSidePanelTab={activeSidePanelTab}
        sidePanelWidth={sidePanelWidth}
        onSidePanelClose={handleSidePanelClose}
        onSidePanelResizeStart={handleSidePanelResize}
        onSidePanelTabChange={handleSidePanelTabChange}

        // Feature specific props needed inside the panel
        terminalId={activeTerminalId ?? null}
        onTerminalClose={handleTerminalClose} // Still needed for internal logic if any
        onPickLocalCwd={handleSelectCwd}
        onSetCwd={handleCwdSelect}
        cwdLocked={cwdLocked}
        onSessionDelete={handleSessionDelete}
        onSessionRename={handleSessionRename}
        onSidebarToggle={isNarrowLayout ? undefined : toggleSidebar}
        onSettingsClick={handleSettingsClick}
        bodyRef={bodyRef}

        onFileSelect={handleFileSelect}
      />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={handleSettingsClose}
        availableModels={modelOptions}
        onModelOptionsResolved={handleModelOptionsFetched}
      />
    </>
  );
}
