import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { ChatContainer } from './components/business/ChatContainer';

import type { Message } from './components/business/ChatMessageList/types';
import type { ChatSession } from './components/business/Sidebar/types';

import './App.css';

// 每个会话的消息独立存储
type SessionMessages = Record<string, Message[]>;

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function newMessageId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
  const activeAcpSessionIdRef = useRef<string | null>(null);

  // 当前会话的消息
  const messages = sessionMessages[selectedSessionId] ?? [];

  useEffect(() => {
    const ensureActiveAcpSession = (incomingSessionId: string) => {
      if (!activeAcpSessionIdRef.current) {
        activeAcpSessionIdRef.current = incomingSessionId;
        return true;
      }
      return activeAcpSessionIdRef.current === incomingSessionId;
    };

    const appendStreamingChunk = (role: Message['role'], text: string) => {
      const sessionId = activeSessionIdRef.current;
      setSessionMessages((prev) => {
        const list = prev[sessionId] ?? [];
        const last = list.length > 0 ? list[list.length - 1] : undefined;

        // 当开始输出回复时，结束上一段思考流
        const shouldCloseThought =
          role === 'assistant' &&
          last?.role === 'thought' &&
          last.isStreaming;

        const baseList = shouldCloseThought
          ? list.map((m, idx) =>
              idx === list.length - 1 ? { ...m, isStreaming: false } : m
            )
          : list;

        const last2 = baseList.length > 0 ? baseList[baseList.length - 1] : undefined;
        if (last2 && last2.role === role && last2.isStreaming) {
          const next = baseList.map((m, idx) => {
            if (idx !== baseList.length - 1) return m;
            return { ...m, content: m.content + text, isStreaming: true };
          });
          return { ...prev, [sessionId]: next };
        }

        const nextMessage: Message = {
          id: newMessageId(),
          role,
          content: text,
          isStreaming: true,
          timestamp: undefined,
        };
        return { ...prev, [sessionId]: [...baseList, nextMessage] };
      });
    };

    const unlistenPromises = [
      listen<{ sessionId: string; text: string }>('codex:message', (event) => {
        if (!ensureActiveAcpSession(event.payload.sessionId)) return;
        appendStreamingChunk('assistant', event.payload.text);
      }),
      listen<{ sessionId: string; text: string }>('codex:thought', (event) => {
        if (!ensureActiveAcpSession(event.payload.sessionId)) return;
        appendStreamingChunk('thought', event.payload.text);
      }),
      listen<{ sessionId: string; stopReason: unknown }>('codex:turn-complete', () => {
        const sessionId = activeSessionIdRef.current;
        const now = new Date();
        setSessionMessages((prev) => {
          const list = prev[sessionId] ?? [];
          const next = list.map((m) => {
            if (m.role === 'user' || !m.isStreaming) return m;
            return {
              ...m,
              isStreaming: false,
              timestamp: m.timestamp ?? now,
            };
          });
          return { ...prev, [sessionId]: next };
        });

        activeAcpSessionIdRef.current = null;
        setIsGenerating(false);
      }),
      listen<{ error: string }>('codex:error', (event) => {
        const sessionId = activeSessionIdRef.current;
        const errMsg: Message = {
          id: newMessageId(),
          role: 'assistant',
          content: `发生错误：${event.payload.error}`,
          isStreaming: false,
          timestamp: new Date(),
        };

        setSessionMessages((prev) => ({
          ...prev,
          [sessionId]: [...(prev[sessionId] ?? []), errMsg],
        }));

        activeAcpSessionIdRef.current = null;
        setIsGenerating(false);
      }),
      listen('codex:approval-request', (event) => {
        // Task0：先用 console 观察审批流，后续接入 ApprovalDialog
        console.debug('[codex approval]', event.payload);
      }),
      listen<{ sessionId: string; toolCall: unknown }>('codex:tool-call', (event) => {
        if (!ensureActiveAcpSession(event.payload.sessionId)) return;

        const sessionId = activeSessionIdRef.current;
        const toolCall = event.payload.toolCall as any;
        const toolCallId = String(toolCall?.toolCallId ?? toolCall?.tool_call_id ?? '');

        const headerParts = [
          '**Tool Call**',
          toolCall?.name ? `\`${String(toolCall.name)}\`` : '',
          toolCallId ? `(id: \`${toolCallId}\`)` : '',
        ].filter(Boolean);

        const msg: Message = {
          id: newMessageId(),
          role: 'tool',
          content: `${headerParts.join(' ')}\n\n\`\`\`json\n${safeJson(toolCall)}\n\`\`\`\n`,
          isStreaming: true,
          timestamp: undefined,
        };

        setSessionMessages((prev) => ({
          ...prev,
          [sessionId]: [...(prev[sessionId] ?? []), msg],
        }));
      }),
      listen<{ sessionId: string; update: unknown }>('codex:tool-call-update', (event) => {
        if (!ensureActiveAcpSession(event.payload.sessionId)) return;

        const sessionId = activeSessionIdRef.current;
        const update = event.payload.update as any;
        const toolCallId = String(update?.toolCallId ?? update?.tool_call_id ?? '');

        const toolIdPart = toolCallId ? ` (id: \`${toolCallId}\`)` : '';
        const chunk = `\n\n**Tool Update**${toolIdPart}\n\n\`\`\`json\n${safeJson(update)}\n\`\`\`\n`;

        const msg: Message = {
          id: newMessageId(),
          role: 'tool',
          content: chunk,
          isStreaming: true,
          timestamp: undefined,
        };

        setSessionMessages((prev) => ({
          ...prev,
          [sessionId]: [...(prev[sessionId] ?? []), msg],
        }));
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
      const now = Date.now();
      const userMessage: Message = {
        id: String(now),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      activeSessionIdRef.current = selectedSessionId;
      activeAcpSessionIdRef.current = null;
      setIsGenerating(true);

      // 更新当前会话的消息
      setSessionMessages((prev) => ({
        ...prev,
        [selectedSessionId]: [...(prev[selectedSessionId] ?? []), userMessage],
      }));

      // 如果是第一条消息，用消息内容更新会话标题
      if (messages.length === 0) {
        const title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
        setSessions((prev) =>
          prev.map((s) => (s.id === selectedSessionId ? { ...s, title } : s))
        );
      }

      void invoke('codex_dev_prompt_once', { cwd: '.', content }).catch((err) => {
        const msg: Message = {
          id: newMessageId(),
          role: 'assistant',
          content: `调用失败：${String(err)}`,
          isStreaming: false,
          timestamp: new Date(),
        };
        setSessionMessages((prev) => ({
          ...prev,
          [selectedSessionId]: [...(prev[selectedSessionId] ?? []), msg],
        }));
        activeAcpSessionIdRef.current = null;
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
