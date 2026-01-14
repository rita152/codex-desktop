import type { ChatSession } from '../components/business/Sidebar/types';
import type { Message } from '../components/business/ChatMessageList/types';
import type { ThinkingData } from '../components/business/ChatMessage/types';
import type { SelectOption } from '../components/ui/data-entry/Select/types';

export type SessionMessages = Record<string, Message[]>;
export type SessionDrafts = Record<string, string>;

interface PersistedMessage extends Omit<Message, 'timestamp'> {
  timestamp?: number;
}

interface PersistedSessionState {
  version: number;
  sessions: ChatSession[];
  selectedSessionId: string;
  messagesBySession: Record<string, PersistedMessage[]>;
  draftsBySession?: Record<string, string>;
}

const STORAGE_KEY = 'codex-desktop.sessions';
const STORAGE_VERSION = 2;

const MODEL_CACHE_KEY = 'codex-desktop.model-options';
const MODEL_CACHE_VERSION = 1;
const MODEL_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface PersistedModelOption {
  value: string;
  label: string;
}

interface PersistedModelOptionsCache {
  version: number;
  updatedAt: number;
  options: PersistedModelOption[];
  currentModelId?: string;
}

function normalizeModelOptions(raw: unknown): SelectOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as { value?: unknown; label?: unknown };
      const value = typeof record.value === 'string' ? record.value.trim() : '';
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      if (!value || !label) return null;
      return { value, label } satisfies SelectOption;
    })
    .filter(Boolean) as SelectOption[];
}

export function loadModelOptionsCache(maxAgeMs: number = MODEL_CACHE_MAX_AGE_MS): {
  options: SelectOption[];
  currentModelId?: string;
  updatedAt: number;
} | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(MODEL_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedModelOptionsCache;
    if (!parsed || parsed.version !== MODEL_CACHE_VERSION) return null;
    if (typeof parsed.updatedAt !== 'number' || !Number.isFinite(parsed.updatedAt)) return null;
    if (Date.now() - parsed.updatedAt > maxAgeMs) return null;
    const options = normalizeModelOptions(parsed.options);
    if (options.length === 0) return null;
    const currentModelId =
      typeof parsed.currentModelId === 'string' && parsed.currentModelId.trim() !== ''
        ? parsed.currentModelId
        : undefined;
    return { options, currentModelId, updatedAt: parsed.updatedAt };
  } catch (err) {
    console.warn('[storage] Failed to load model options cache', err);
    return null;
  }
}

export function saveModelOptionsCache(payload: {
  options: SelectOption[];
  currentModelId?: string;
}): void {
  if (typeof localStorage === 'undefined') return;

  const options: PersistedModelOption[] = payload.options
    .map((option) => ({
      value: String(option.value),
      label: String(option.label),
    }))
    .filter((option) => option.value.trim() !== '' && option.label.trim() !== '');

  if (options.length === 0) return;

  const persisted: PersistedModelOptionsCache = {
    version: MODEL_CACHE_VERSION,
    updatedAt: Date.now(),
    options,
    currentModelId:
      typeof payload.currentModelId === 'string' && payload.currentModelId.trim() !== ''
        ? payload.currentModelId
        : undefined,
  };

  try {
    localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify(persisted));
  } catch (err) {
    console.warn('[storage] Failed to save model options cache', err);
  }
}

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
      const record = item as { id?: unknown; title?: unknown; cwd?: unknown; model?: unknown };
      if (typeof record.id !== 'string' || record.id.trim() === '') return null;
      const title = typeof record.title === 'string' ? record.title : '新对话';
      const cwd = typeof record.cwd === 'string' && record.cwd.trim() !== '' ? record.cwd : undefined;
      const model =
        typeof record.model === 'string' && record.model.trim() !== '' ? record.model : undefined;
      return { id: record.id, title, cwd, model } satisfies ChatSession;
    })
    .filter(Boolean) as ChatSession[];
}

function normalizeDrafts(raw: unknown): SessionDrafts {
  if (!raw || typeof raw !== 'object') return {};
  const drafts: SessionDrafts = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') drafts[key] = value;
  }
  return drafts;
}

export function loadSessionState(): {
  sessions: ChatSession[];
  selectedSessionId: string;
  sessionMessages: SessionMessages;
  sessionDrafts: SessionDrafts;
} | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedSessionState;
    if (!parsed || (parsed.version !== 1 && parsed.version !== 2)) return null;

    const sessions = normalizeSessions(parsed.sessions);
    if (sessions.length === 0) return null;

    const messagesBySession = parsed.messagesBySession ?? {};
    const sessionMessages: SessionMessages = {};
    const draftsBySession = normalizeDrafts(parsed.draftsBySession);
    const sessionDrafts: SessionDrafts = {};

    for (const session of sessions) {
      const storedMessages = messagesBySession[session.id];
      if (Array.isArray(storedMessages)) {
        sessionMessages[session.id] = storedMessages.map(toRuntimeMessage);
      } else {
        sessionMessages[session.id] = [];
      }

      const draft = draftsBySession[session.id];
      sessionDrafts[session.id] = typeof draft === 'string' ? draft : '';
    }

    const selectedSessionId = sessions.some((s) => s.id === parsed.selectedSessionId)
      ? parsed.selectedSessionId
      : sessions[0].id;

    return { sessions, selectedSessionId, sessionMessages, sessionDrafts };
  } catch (err) {
    console.warn('[storage] Failed to load session state', err);
    return null;
  }
}

export function saveSessionState(state: {
  sessions: ChatSession[];
  selectedSessionId: string;
  sessionMessages: SessionMessages;
  sessionDrafts: SessionDrafts;
}): void {
  if (typeof localStorage === 'undefined') return;

  const messagesBySession: Record<string, PersistedMessage[]> = {};
  const draftsBySession: Record<string, string> = {};
  for (const session of state.sessions) {
    const messages = state.sessionMessages[session.id] ?? [];
    messagesBySession[session.id] = messages.map(toPersistedMessage);
    draftsBySession[session.id] = state.sessionDrafts[session.id] ?? '';
  }

  const payload: PersistedSessionState = {
    version: STORAGE_VERSION,
    sessions: state.sessions,
    selectedSessionId: state.selectedSessionId,
    messagesBySession,
    draftsBySession,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[storage] Failed to save session state', err);
  }
}
