import type { ChatSession } from '../components/business/Sidebar/types';
import type { Message } from '../components/business/ChatMessageList/types';
import type { ThinkingData } from '../components/business/ChatMessage/types';

export type SessionMessages = Record<string, Message[]>;

interface PersistedMessage extends Omit<Message, 'timestamp'> {
  timestamp?: number;
}

interface PersistedSessionState {
  version: number;
  sessions: ChatSession[];
  selectedSessionId: string;
  messagesBySession: Record<string, PersistedMessage[]>;
}

const STORAGE_KEY = 'codex-desktop.sessions';
const STORAGE_VERSION = 1;

function normalizeThinking(thinking?: ThinkingData): ThinkingData | undefined {
  if (!thinking) return undefined;
  return {
    ...thinking,
    isStreaming: false,
    phase: 'done',
  };
}

function toPersistedMessage(message: Message): PersistedMessage {
  return {
    ...message,
    isStreaming: false,
    thinking: normalizeThinking(message.thinking),
    timestamp: message.timestamp ? message.timestamp.getTime() : undefined,
  };
}

function toRuntimeMessage(message: PersistedMessage): Message {
  const timestamp =
    typeof message.timestamp === 'number' ? new Date(message.timestamp) : undefined;

  return {
    ...message,
    isStreaming: false,
    thinking: normalizeThinking(message.thinking),
    timestamp,
  };
}

function normalizeSessions(raw: unknown): ChatSession[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as { id?: unknown; title?: unknown };
      if (typeof record.id !== 'string' || record.id.trim() === '') return null;
      const title = typeof record.title === 'string' ? record.title : '新对话';
      return { id: record.id, title } satisfies ChatSession;
    })
    .filter(Boolean) as ChatSession[];
}

export function loadSessionState(): {
  sessions: ChatSession[];
  selectedSessionId: string;
  sessionMessages: SessionMessages;
} | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedSessionState;
    if (!parsed || parsed.version !== STORAGE_VERSION) return null;

    const sessions = normalizeSessions(parsed.sessions);
    if (sessions.length === 0) return null;

    const messagesBySession = parsed.messagesBySession ?? {};
    const sessionMessages: SessionMessages = {};

    for (const session of sessions) {
      const storedMessages = messagesBySession[session.id];
      if (Array.isArray(storedMessages)) {
        sessionMessages[session.id] = storedMessages.map(toRuntimeMessage);
      } else {
        sessionMessages[session.id] = [];
      }
    }

    const selectedSessionId = sessions.some((s) => s.id === parsed.selectedSessionId)
      ? parsed.selectedSessionId
      : sessions[0].id;

    return { sessions, selectedSessionId, sessionMessages };
  } catch (err) {
    console.warn('[storage] Failed to load session state', err);
    return null;
  }
}

export function saveSessionState(state: {
  sessions: ChatSession[];
  selectedSessionId: string;
  sessionMessages: SessionMessages;
}): void {
  if (typeof localStorage === 'undefined') return;

  const messagesBySession: Record<string, PersistedMessage[]> = {};
  for (const session of state.sessions) {
    const messages = state.sessionMessages[session.id] ?? [];
    messagesBySession[session.id] = messages.map(toPersistedMessage);
  }

  const payload: PersistedSessionState = {
    version: STORAGE_VERSION,
    sessions: state.sessions,
    selectedSessionId: state.selectedSessionId,
    messagesBySession,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[storage] Failed to save session state', err);
  }
}
