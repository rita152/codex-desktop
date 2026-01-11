import { useState, useCallback } from 'react';

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

  // 当前会话的消息
  const messages = sessionMessages[selectedSessionId] ?? [];

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

      // TODO: 调用后端 API 获取 AI 回复
      // 模拟 AI 回复
      setTimeout(() => {
        const aiMessage: Message = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: '这是一条模拟的 AI 回复。后续会接入真实的后端 API。',
          timestamp: new Date(),
        };
        setSessionMessages((prev) => ({
          ...prev,
          [selectedSessionId]: [...(prev[selectedSessionId] ?? []), aiMessage],
        }));
      }, 500);
    },
    [selectedSessionId, messages.length]
  );

  return (
    <ChatContainer
      sessions={sessions}
      selectedSessionId={selectedSessionId}
      messages={messages}
      sidebarVisible={sidebarVisible}
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
