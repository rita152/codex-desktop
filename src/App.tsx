import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { ChatContainer } from './components/business/ChatContainer';

import type { Message } from './components/business/ChatMessageList/types';
import type { ChatSession } from './components/business/Sidebar/types';

import './App.css';

// 每个会话的消息独立存储
type SessionMessages = Record<string, Message[]>;

function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([
    { id: '1', title: '新对话' },
  ]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('1');
  const [sessionMessages, setSessionMessages] = useState<SessionMessages>({
    '1': [],
  });
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const activeSessionIdRef = useRef<string>('1');
  const activeAssistantMessageIdRef = useRef<string | null>(null);
  const activeAssistantAnswerStartedRef = useRef(false);

  // 当前会话的消息
  const messages = sessionMessages[selectedSessionId] ?? [];

  useEffect(() => {
    const unlistenPromises = [
      listen<{ sessionId: string; text: string }>('codex:message', (event) => {
        const sessionId = activeSessionIdRef.current;
        const assistantMessageId = activeAssistantMessageIdRef.current;
        if (!assistantMessageId) return;

        activeAssistantAnswerStartedRef.current = true;

        setSessionMessages((prev) => {
          const list = prev[sessionId] ?? [];
          const next = list.map((m) => {
            if (String(m.id) !== assistantMessageId) return m;
            return {
              ...m,
              content: m.content + event.payload.text,
              isStreaming: true,
              // 一旦开始输出回复，认为“思考结束”，立刻隐藏思考组件
              thinking: undefined,
            };
          });
          return { ...prev, [sessionId]: next };
        });
      }),
      listen<{ sessionId: string; text: string }>('codex:thought', (event) => {
        const sessionId = activeSessionIdRef.current;
        const assistantMessageId = activeAssistantMessageIdRef.current;
        if (!assistantMessageId) return;
        // 如果已经开始输出最终回复，则不再展示/更新思考内容
        if (activeAssistantAnswerStartedRef.current) return;

        setSessionMessages((prev) => {
          const list = prev[sessionId] ?? [];
          const now = Date.now();
          const next = list.map((m) => {
            if (String(m.id) !== assistantMessageId) return m;
            const startTime = m.thinking?.startTime ?? now;
            return {
              ...m,
              thinking: {
                content: (m.thinking?.content ?? '') + event.payload.text,
                isStreaming: true,
                startTime,
              },
            };
          });
          return { ...prev, [sessionId]: next };
        });
      }),
      listen<{ sessionId: string; stopReason: unknown }>('codex:turn-complete', () => {
        const sessionId = activeSessionIdRef.current;
        const assistantMessageId = activeAssistantMessageIdRef.current;
        if (!assistantMessageId) return;

        activeAssistantAnswerStartedRef.current = false;

        setSessionMessages((prev) => {
          const list = prev[sessionId] ?? [];
          const next = list.map((m) => {
            if (String(m.id) !== assistantMessageId) return m;
            return {
              ...m,
              isStreaming: false,
              timestamp: new Date(),
              thinking: undefined,
            };
          });
          return { ...prev, [sessionId]: next };
        });

        activeAssistantMessageIdRef.current = null;
        setIsGenerating(false);
      }),
      listen<{ error: string }>('codex:error', (event) => {
        const sessionId = activeSessionIdRef.current;
        const assistantMessageId = activeAssistantMessageIdRef.current;
        if (!assistantMessageId) return;

        activeAssistantAnswerStartedRef.current = false;

        setSessionMessages((prev) => {
          const list = prev[sessionId] ?? [];
          const next = list.map((m) => {
            if (String(m.id) !== assistantMessageId) return m;
            return {
              ...m,
              content: `发生错误：${event.payload.error}`,
              isStreaming: false,
              timestamp: new Date(),
              thinking: undefined,
            };
          });
          return { ...prev, [sessionId]: next };
        });

        activeAssistantMessageIdRef.current = null;
        setIsGenerating(false);
      }),
      listen('codex:approval-request', (event) => {
        // Task0：先用 console 观察审批流，后续接入 ApprovalDialog
        console.debug('[codex approval]', event.payload);
      }),
      listen('codex:tool-call', (event) => {
        console.debug('[codex tool-call]', event.payload);
      }),
      listen('codex:tool-call-update', (event) => {
        console.debug('[codex tool-call-update]', event.payload);
      }),
    ];

    return () => {
      Promise.all(unlistenPromises)
        .then((unlisteners) => unlisteners.forEach((u) => u()))
        .catch(() => {});
    };
  }, []);

  const handleNewChat = useCallback(() => {
    const newId = String(Date.now());
    const newSession: ChatSession = {
      id: newId,
      title: '新对话',
    };
    setSessions((prev) => [newSession, ...prev]);
    setSessionMessages((prev) => ({ ...prev, [newId]: [] }));
    setSelectedSessionId(newId);
  }, []);

  const handleSessionSelect = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
  }, []);

  const handleSessionDelete = useCallback(
    (sessionId: string) => {
      // 不允许删除最后一个会话
      if (sessions.length <= 1) return;

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setSessionMessages((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });

      // 如果删除的是当前选中的会话，切换到第一个会话
      if (sessionId === selectedSessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          setSelectedSessionId(remaining[0].id);
        }
      }
    },
    [sessions, selectedSessionId]
  );

  const handleSessionRename = useCallback(
    (sessionId: string, newTitle: string) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
      );
    },
    []
  );

  const handleSendMessage = useCallback(
    (content: string) => {
      const userMessage: Message = {
        id: String(Date.now()),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      const assistantMessageId = String(Date.now() + 1);
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        // assistant 消息时间戳应为“回答完毕时刻”，因此先不设置
        timestamp: undefined,
      };

      activeSessionIdRef.current = selectedSessionId;
      activeAssistantMessageIdRef.current = assistantMessageId;
      activeAssistantAnswerStartedRef.current = false;
      setIsGenerating(true);

      // 更新当前会话的消息
      setSessionMessages((prev) => ({
        ...prev,
        [selectedSessionId]: [
          ...(prev[selectedSessionId] ?? []),
          userMessage,
          assistantMessage,
        ],
      }));

      // 如果是第一条消息，用消息内容更新会话标题
      if (messages.length === 0) {
        const title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
        setSessions((prev) =>
          prev.map((s) => (s.id === selectedSessionId ? { ...s, title } : s))
        );
      }

      void invoke('codex_dev_prompt_once', { cwd: '.', content }).catch((err) => {
        setSessionMessages((prev) => {
          const list = prev[selectedSessionId] ?? [];
          const next = list.map((m) => {
            if (String(m.id) !== assistantMessageId) return m;
            return {
              ...m,
              content: `调用失败：${String(err)}`,
              isStreaming: false,
              timestamp: new Date(),
            };
          });
          return { ...prev, [selectedSessionId]: next };
        });
        activeAssistantMessageIdRef.current = null;
        setIsGenerating(false);
      });
    },
    [selectedSessionId, messages.length]
  );

  return (
    <ChatContainer
      sessions={sessions}
      selectedSessionId={selectedSessionId}
      messages={messages}
      sidebarVisible={sidebarVisible}
      isGenerating={isGenerating}
      onSessionSelect={handleSessionSelect}
      onNewChat={handleNewChat}
      onSendMessage={handleSendMessage}
      onSessionDelete={handleSessionDelete}
      onSessionRename={handleSessionRename}
      onSidebarToggle={() => setSidebarVisible((v) => !v)}
    />
  );
}

export default App;
