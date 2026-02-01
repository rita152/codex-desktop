/**
 * Codex Events Hook
 *
 * Subscribes to Tauri Codex events and updates stores directly.
 * This is a singleton listener - uses globalThis to prevent duplicate subscriptions.
 *
 * @migration This hook now uses Stores directly instead of receiving setState functions.
 */

import { useEffect, useMemo, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

import { devDebug } from '../utils/logger';
import {
  asRecord,
  extractSlashCommands,
  getString,
  newMessageId,
  parseToolCall,
  resolveModelOptions,
  resolveModeOptions,
} from '../utils/codexParsing';
import i18n from '../i18n';
import { createCodexMessageHandlers } from './codexEventMessageHandlers';
import { useSessionStore } from '../stores/sessionStore';
import { useCodexStore } from '../stores/codexStore';
import { DEFAULT_MODEL_ID, DEFAULT_MODE_ID } from '../constants/chat';

import type { MutableRefObject } from 'react';
import type { Message } from '../types/message';
import type {
  ApprovalRequest,
  ThreadNameUpdatedEvent,
  ThreadRolledBackEvent,
  RequestUserInputEvent,
  DynamicToolCallEvent,
  ElicitationRequestEvent,
  ViewImageEvent,
  TerminalInteractionEvent,
  UndoStartedEvent,
  UndoCompletedEvent,
  DeprecationNoticeEvent,
  BackgroundEventPayload,
  ContextCompactedEvent,
  McpStartupUpdateEvent,
  McpStartupCompleteEvent,
} from '../types/codex';
import type { PlanStep, PlanStatus } from '../types/plan';

/**
 * Maps backend PlanEntry status strings to frontend PlanStatus values.
 * Backend uses: pending, in_progress, completed
 * Frontend uses: pending, active, completed, error
 */
function mapPlanStatus(backendStatus: string): PlanStatus {
  switch (backendStatus.toLowerCase()) {
    case 'pending':
      return 'pending';
    case 'in_progress':
    case 'inprogress':
      return 'active';
    case 'completed':
      return 'completed';
    case 'error':
    case 'failed':
      return 'error';
    default:
      return 'pending';
  }
}

type UnlistenFn = () => void;

type ListenerState = {
  token: number;
  unlistenPromise: Promise<UnlistenFn[]> | null;
};

const getListenerState = (): ListenerState => {
  const globalScope = globalThis as typeof globalThis & {
    __codexEventListenerState?: ListenerState;
  };
  if (!globalScope.__codexEventListenerState) {
    globalScope.__codexEventListenerState = { token: 0, unlistenPromise: null };
  }
  return globalScope.__codexEventListenerState;
};

const beginListeners = () => {
  const state = getListenerState();
  if (state.unlistenPromise) {
    state.unlistenPromise
      .then((unlisteners) =>
        unlisteners.forEach((unlisten) => {
          unlisten();
        })
      )
      .catch(() => {});
  }
  state.token += 1;
  return state.token;
};

const commitListeners = (token: number, listenPromises: Promise<UnlistenFn>[]) => {
  const state = getListenerState();
  if (state.token !== token) return;
  state.unlistenPromise = Promise.all(listenPromises);
};

const removeListeners = (token: number) => {
  const state = getListenerState();
  if (token !== state.token || !state.unlistenPromise) return;
  state.unlistenPromise
    .then((unlisteners) =>
      unlisteners.forEach((unlisten) => {
        unlisten();
      })
    )
    .catch(() => {});
  state.unlistenPromise = null;
};

/**
 * Options for mode/model resolution callbacks
 */
export interface CodexEventsCallbacks {
  onModeOptionsResolved?: (modeState: {
    options: { value: string; label: string }[];
    currentModeId?: string;
  }) => void;
  onModelOptionsResolved?: (modelState: {
    options: { value: string; label: string }[];
    currentModelId?: string;
  }) => void;
}

/**
 * Initialize Codex event listeners.
 * This hook sets up all Tauri event subscriptions and updates stores directly.
 *
 * @param callbacks - Optional callbacks for mode/model options resolution
 */
export function useCodexEvents(callbacks?: CodexEventsCallbacks): void {
  // Refs for callbacks to avoid re-subscribing on callback changes
  const onModeOptionsResolvedRef = useRef(callbacks?.onModeOptionsResolved);
  const onModelOptionsResolvedRef = useRef(callbacks?.onModelOptionsResolved);
  onModeOptionsResolvedRef.current = callbacks?.onModeOptionsResolved;
  onModelOptionsResolvedRef.current = callbacks?.onModelOptionsResolved;

  // Ref to track active session ID (updated from store subscription)
  const activeSessionIdRef = useRef<string>('');

  // Subscribe to selectedSessionId changes to keep ref in sync
  useEffect(() => {
    // Initialize from current state
    activeSessionIdRef.current = useSessionStore.getState().selectedSessionId;

    // Subscribe to changes
    const unsubscribe = useSessionStore.subscribe((state) => {
      activeSessionIdRef.current = state.selectedSessionId;
    });
    return unsubscribe;
  }, []);

  // Create message handlers with a ref-based setter
  const setSessionMessagesRef = useRef(useSessionStore.getState().setSessionMessages);
  // Keep ref in sync
  useEffect(() => {
    setSessionMessagesRef.current = useSessionStore.getState().setSessionMessages;
  }, []);

  const messageHandlers = useMemo(
    () =>
      createCodexMessageHandlers(
        setSessionMessagesRef as MutableRefObject<typeof setSessionMessagesRef.current>
      ),
    []
  );

  useEffect(() => {
    let isActive = true;
    const isListenerActive = () => isActive && listenerToken === getListenerState().token;
    const {
      appendAssistantChunk,
      appendThoughtChunk,
      applyToolCallUpdateMessage,
      finalizeStreamingMessages,
      upsertToolCallMessage,
    } = messageHandlers;

    // Helper to resolve chat session ID from codex session ID
    const resolveChatSessionId = (codexSessionId?: string): string | null => {
      if (!codexSessionId) return null;
      return useCodexStore.getState().resolveChatSessionId(codexSessionId) ?? null;
    };

    const listenerToken = beginListeners();
    const unlistenPromises = [
      listen<{ sessionId: string; text: string }>('codex:message', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        appendAssistantChunk(sessionId, event.payload.text);
      }),
      // User message (from history replay)
      listen<{ sessionId: string; text: string }>('codex:user-message', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const userMsg: Message = {
          id: newMessageId(),
          role: 'user',
          content: event.payload.text,
          isStreaming: false,
          timestamp: new Date(),
        };
        useSessionStore.getState().addMessage(sessionId, userMsg);
      }),
      listen<{ sessionId: string; text: string }>('codex:thought', (event) => {
        if (!isListenerActive()) return;
        devDebug('[codex:thought] Received', {
          sessionId: event.payload.sessionId,
          textLen: event.payload.text.length,
        });
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        appendThoughtChunk(sessionId, event.payload.text);
      }),
      listen<{ sessionId: string; stopReason: unknown }>('codex:turn-complete', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        finalizeStreamingMessages(sessionId);
        useSessionStore.getState().setIsGenerating(sessionId, false);
      }),
      listen<{ error: string }>('codex:error', (event) => {
        if (!isListenerActive()) return;
        const sessionId = activeSessionIdRef.current;
        const errMsg: Message = {
          id: newMessageId(),
          role: 'assistant',
          content: i18n.t('errors.genericError', { error: event.payload.error }),
          isStreaming: false,
          timestamp: new Date(),
        };

        useSessionStore.getState().addMessage(sessionId, errMsg);
        useSessionStore.getState().setIsGenerating(sessionId, false);
      }),
      listen<ApprovalRequest>('codex:approval-request', (event) => {
        if (!isListenerActive()) return;
        useCodexStore.getState().registerApprovalRequest(event.payload);
      }),
      listen<{ sessionId: string; update: unknown }>('codex:available-commands', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const commands = extractSlashCommands(event.payload.update);
        if (commands.length === 0) return;
        useSessionStore
          .getState()
          .setSessionSlashCommands((prev) => ({ ...prev, [sessionId]: commands }));
      }),
      listen<{ sessionId: string; update: unknown }>('codex:current-mode', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const update = asRecord(event.payload.update);
        if (!update) return;
        const modeId = getString(update.currentModeId ?? update.current_mode_id);
        if (!modeId) return;
        useSessionStore.getState().updateSession(sessionId, { mode: modeId });
      }),
      listen<{ sessionId: string; update: unknown }>('codex:config-option-update', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const update = asRecord(event.payload.update);
        if (!update) return;
        const configOptions = update.configOptions ?? update.config_options ?? update.configOption;

        const modeState = resolveModeOptions(undefined, configOptions);
        if (modeState?.options.length) {
          useSessionStore
            .getState()
            .setSessionModeOptions((prev) => ({ ...prev, [sessionId]: modeState.options }));
          onModeOptionsResolvedRef.current?.(modeState);
          useSessionStore.getState().applyModeOptions({
            options: modeState.options,
            currentId: modeState.currentModeId,
            fallbackCurrentId: DEFAULT_MODE_ID,
          });
        }
        if (modeState?.currentModeId) {
          useSessionStore.getState().updateSession(sessionId, { mode: modeState.currentModeId });
        }

        const modelState = resolveModelOptions(undefined, configOptions);
        if (modelState?.options.length) {
          useSessionStore
            .getState()
            .setSessionModelOptions((prev) => ({ ...prev, [sessionId]: modelState.options }));
          onModelOptionsResolvedRef.current?.(modelState);
          useSessionStore.getState().applyModelOptions({
            options: modelState.options,
            currentId: modelState.currentModelId,
            fallbackCurrentId: DEFAULT_MODEL_ID,
          });
        }
        if (modelState?.currentModelId) {
          useSessionStore.getState().updateSession(sessionId, { model: modelState.currentModelId });
        }
      }),
      listen<{ sessionId: string; toolCall: unknown }>('codex:tool-call', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const toolCall = asRecord(event.payload.toolCall);
        if (!toolCall) return;
        const parsed = parseToolCall(toolCall);
        upsertToolCallMessage(sessionId, parsed);
      }),
      listen<{ sessionId: string; update: unknown }>('codex:tool-call-update', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        const update = asRecord(event.payload.update);
        if (!update) return;
        applyToolCallUpdateMessage(sessionId, update);
      }),
      // Plan update from update_plan tool
      // Backend sends: { sessionId, plan: [{ step, status }], explanation?: string }
      listen<{
        sessionId: string;
        plan: Array<{ step: string; status: string }>;
        explanation?: string;
      }>('codex:plan', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        devDebug('[codex:plan]', {
          sessionId,
          plan: event.payload.plan,
          explanation: event.payload.explanation,
        });
        const planItems = event.payload.plan;
        if (planItems && Array.isArray(planItems)) {
          const steps: PlanStep[] = planItems.map((item, index) => ({
            id: `plan-step-${index}`,
            title: item.step,
            status: mapPlanStatus(item.status),
          }));
          messageHandlers.updatePlan(sessionId, steps, event.payload.explanation);
        }
      }),
      // Token usage event - context remaining percentage
      listen<{
        sessionId: string;
        info: unknown;
        rateLimits: unknown;
        percentRemaining: number | null;
      }>('codex:token-usage', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        useSessionStore.getState().setContextRemaining(sessionId, event.payload.percentRemaining);
      }),

      // === New Events ===

      // Thread name updated - update session title
      listen<ThreadNameUpdatedEvent>('codex:thread-name-updated', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        devDebug('[codex:thread-name-updated]', {
          sessionId,
          threadName: event.payload.threadName,
        });
        if (event.payload.threadName) {
          useSessionStore.getState().updateSession(sessionId, {
            title: event.payload.threadName,
          });
        }
      }),

      // Thread rolled back - notify user about context rollback
      listen<ThreadRolledBackEvent>('codex:thread-rolled-back', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        devDebug('[codex:thread-rolled-back]', {
          sessionId,
          numTurns: event.payload.numTurns,
        });
        // Add a system message to notify user
        const systemMsg: Message = {
          id: newMessageId(),
          role: 'assistant',
          content: i18n.t('chat.threadRolledBack', {
            count: event.payload.numTurns,
            defaultValue: `Context rolled back by ${event.payload.numTurns} turn(s) to fit within context window.`,
          }),
          isStreaming: false,
          timestamp: new Date(),
        };
        useSessionStore.getState().addMessage(sessionId, systemMsg);
      }),

      // Request user input - register pending user input request
      listen<RequestUserInputEvent>('codex:request-user-input', (event) => {
        if (!isListenerActive()) return;
        devDebug('[codex:request-user-input]', {
          sessionId: event.payload.sessionId,
          callId: event.payload.callId,
          questions: event.payload.questions,
        });
        useCodexStore.getState().registerUserInputRequest(event.payload);
      }),

      // Dynamic tool call request
      listen<DynamicToolCallEvent>('codex:dynamic-tool-call', (event) => {
        if (!isListenerActive()) return;
        devDebug('[codex:dynamic-tool-call]', {
          sessionId: event.payload.sessionId,
          tool: event.payload.tool,
        });
        useCodexStore.getState().registerDynamicToolCall(event.payload);
      }),

      // MCP elicitation request
      listen<ElicitationRequestEvent>('codex:elicitation-request', (event) => {
        if (!isListenerActive()) return;
        devDebug('[codex:elicitation-request]', {
          sessionId: event.payload.sessionId,
          serverName: event.payload.serverName,
          message: event.payload.message,
        });
        useCodexStore.getState().registerElicitationRequest(event.payload);
      }),

      // View image tool call - show image in chat
      listen<ViewImageEvent>('codex:view-image', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        devDebug('[codex:view-image]', {
          sessionId,
          path: event.payload.path,
        });
        // Emit as a tool call for display
        upsertToolCallMessage(sessionId, {
          toolCallId: event.payload.callId,
          title: `View Image: ${event.payload.path}`,
          kind: 'read',
          status: 'completed',
          content: [{ type: 'text', text: event.payload.path }],
        });
      }),

      // Terminal interaction - stdin sent to running process
      listen<TerminalInteractionEvent>('codex:terminal-interaction', (event) => {
        if (!isListenerActive()) return;
        devDebug('[codex:terminal-interaction]', {
          sessionId: event.payload.sessionId,
          callId: event.payload.callId,
          stdin: event.payload.stdin,
        });
        // Update the existing tool call with stdin info
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        applyToolCallUpdateMessage(sessionId, {
          toolCallId: event.payload.callId,
          tool_call_id: event.payload.callId,
          stdin: event.payload.stdin,
        });
      }),

      // Undo started
      listen<UndoStartedEvent>('codex:undo-started', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        devDebug('[codex:undo-started]', { sessionId });
        useCodexStore.getState().setUndoInProgress(sessionId, true);
      }),

      // Undo completed
      listen<UndoCompletedEvent>('codex:undo-completed', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        devDebug('[codex:undo-completed]', {
          sessionId,
          success: event.payload.success,
        });
        useCodexStore.getState().setUndoInProgress(sessionId, false);
        // Notify user about undo result
        const resultMsg: Message = {
          id: newMessageId(),
          role: 'assistant',
          content: event.payload.success
            ? i18n.t('chat.undoSuccess', { defaultValue: 'Changes have been undone.' })
            : i18n.t('chat.undoFailed', {
                message: event.payload.message,
                defaultValue: `Undo failed: ${event.payload.message ?? 'Unknown error'}`,
              }),
          isStreaming: false,
          timestamp: new Date(),
        };
        useSessionStore.getState().addMessage(sessionId, resultMsg);
      }),

      // Deprecation notice
      listen<DeprecationNoticeEvent>('codex:deprecation-notice', (event) => {
        if (!isListenerActive()) return;
        devDebug('[codex:deprecation-notice]', {
          sessionId: event.payload.sessionId,
          summary: event.payload.summary,
        });
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        // Show deprecation warning to user
        const warnMsg: Message = {
          id: newMessageId(),
          role: 'assistant',
          content: `⚠️ ${event.payload.summary}${event.payload.details ? `\n\n${event.payload.details}` : ''}`,
          isStreaming: false,
          timestamp: new Date(),
        };
        useSessionStore.getState().addMessage(sessionId, warnMsg);
      }),

      // Background event
      listen<BackgroundEventPayload>('codex:background-event', (event) => {
        if (!isListenerActive()) return;
        devDebug('[codex:background-event]', {
          sessionId: event.payload.sessionId,
          message: event.payload.message,
        });
        // Log background events but don't display to user by default
      }),

      // Context compacted - notify user about memory optimization
      listen<ContextCompactedEvent>('codex:context-compacted', (event) => {
        if (!isListenerActive()) return;
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        devDebug('[codex:context-compacted]', { sessionId });
        // Add a system message to notify user
        const systemMsg: Message = {
          id: newMessageId(),
          role: 'assistant',
          content: i18n.t('chat.contextCompacted', {
            defaultValue: 'Context has been compacted to fit within the model context window.',
          }),
          isStreaming: false,
          timestamp: new Date(),
        };
        useSessionStore.getState().addMessage(sessionId, systemMsg);
      }),

      // MCP startup update - track MCP server startup progress
      listen<McpStartupUpdateEvent>('codex:mcp-startup-update', (event) => {
        if (!isListenerActive()) return;
        devDebug('[codex:mcp-startup-update]', {
          sessionId: event.payload.sessionId,
          server: event.payload.server,
          status: event.payload.status,
        });
        // Could update UI to show MCP startup progress
        // For now, just log
      }),

      // MCP startup complete - all MCP servers have finished starting
      listen<McpStartupCompleteEvent>('codex:mcp-startup-complete', (event) => {
        if (!isListenerActive()) return;
        devDebug('[codex:mcp-startup-complete]', {
          sessionId: event.payload.sessionId,
          ready: event.payload.ready,
          failed: event.payload.failed,
          cancelled: event.payload.cancelled,
        });
        // Notify user if any MCP servers failed
        const sessionId = resolveChatSessionId(event.payload.sessionId);
        if (!sessionId) return;
        if (event.payload.failed && event.payload.failed.length > 0) {
          const failedMsg: Message = {
            id: newMessageId(),
            role: 'assistant',
            content: i18n.t('chat.mcpServersFailed', {
              servers: event.payload.failed.join(', '),
              defaultValue: `MCP servers failed to start: ${event.payload.failed.join(', ')}`,
            }),
            isStreaming: false,
            timestamp: new Date(),
          };
          useSessionStore.getState().addMessage(sessionId, failedMsg);
        }
      }),
    ];
    commitListeners(listenerToken, unlistenPromises);

    return () => {
      isActive = false;
      removeListeners(listenerToken);
    };
  }, [messageHandlers]);
}
