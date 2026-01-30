/**
 * Approval Cards Hook
 *
 * Transforms pending approval requests into ApprovalProps for rendering.
 * Uses Stores directly for state management.
 *
 * @migration Now uses Stores directly instead of receiving setState functions
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { approveRequest } from '../api/codex';
import {
  approvalStatusFromKind,
  asRecord,
  extractApprovalDescription,
  extractApprovalDiffs,
  extractCommand,
  formatError,
  getString,
  mapApprovalOptions,
  normalizeToolKind,
} from '../utils/codexParsing';
import { devDebug } from '../utils/logger';
import { useSessionStore } from '../stores/sessionStore';
import { useCodexStore } from '../stores/codexStore';

import type {
  ApprovalProps,
  ApprovalStatus,
  PermissionOptionKind,
} from '../components/ui/feedback/Approval';
import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { ApprovalRequest } from '../types/codex';
import type { SessionNotice } from './useSessionMeta';

/**
 * Hook to get approval cards for the current session.
 * Uses Stores directly for state management.
 *
 * @returns Array of ApprovalProps ready for rendering
 */
export function useApprovalCardsFromStore(): ApprovalProps[] {
  const { t } = useTranslation();
  const selectedSessionId = useSessionStore((state) => state.selectedSessionId);

  // Get approval state from CodexStore - use raw map to avoid creating new arrays
  const pendingApprovalsMap = useCodexStore((state) => state.pendingApprovals);
  const approvalStatuses = useCodexStore((state) => state.approvalStatuses);
  const approvalLoading = useCodexStore((state) => state.approvalLoading);

  // Derive array outside of selector
  const pendingApprovals = useMemo(
    () => Object.values(pendingApprovalsMap),
    [pendingApprovalsMap]
  );

  const handleApprovalSelect = useCallback(
    async (
      sessionId: string,
      requestId: string,
      optionId: string,
      optionKind: PermissionOptionKind
    ) => {
      const codexStore = useCodexStore.getState();
      const sessionStore = useSessionStore.getState();

      codexStore.setApprovalLoading(requestId, true);
      const nextStatus = approvalStatusFromKind(optionKind);
      codexStore.setApprovalStatus(requestId, nextStatus);

      try {
        await approveRequest(sessionId, requestId, undefined, optionId);
        codexStore.setApprovalLoading(requestId, false);
        window.setTimeout(() => {
          codexStore.clearApproval(requestId);
        }, 900);
      } catch (err) {
        devDebug('[approval failed]', err);
        codexStore.setApprovalLoading(requestId, false);
        codexStore.setApprovalStatus(requestId, 'pending');

        const chatSessionId = codexStore.resolveChatSessionId(sessionId);
        if (chatSessionId) {
          sessionStore.setNotice(chatSessionId, {
            kind: 'error',
            message: t('errors.approvalFailed', { error: formatError(err) }),
          });
        }
      }
    },
    [t]
  );

  return useMemo(
    () =>
      pendingApprovals
        .filter((request) => {
          const chatSessionId = useCodexStore.getState().resolveChatSessionId(request.sessionId);
          return chatSessionId === selectedSessionId;
        })
        .map((request) => {
          const toolCall = asRecord(request.toolCall) ?? {};
          const toolKind = normalizeToolKind(toolCall.kind);
          const type = toolKind === 'edit' ? 'patch' : 'exec';
          const title = getString(toolCall.title ?? toolCall.name) ?? t('approval.title');
          const description = extractApprovalDescription(toolCall);
          const command = extractCommand(toolCall.rawInput ?? toolCall.raw_input);
          const diffs = extractApprovalDiffs(toolCall);
          const options = mapApprovalOptions(request.options);

          return {
            callId: request.requestId,
            type,
            title,
            status: approvalStatuses[request.requestId] ?? 'pending',
            description,
            command,
            diffs: diffs.length > 0 ? diffs : undefined,
            options: options.length > 0 ? options : undefined,
            loading: approvalLoading[request.requestId] ?? false,
            onSelect: (_callId, optionId) => {
              const option = options.find((o) => o.id === optionId);
              const kind: PermissionOptionKind = option?.kind ?? 'allow-once';
              void handleApprovalSelect(request.sessionId, request.requestId, optionId, kind);
            },
          } satisfies ApprovalProps;
        }),
    [
      approvalLoading,
      approvalStatuses,
      handleApprovalSelect,
      pendingApprovals,
      selectedSessionId,
      t,
    ]
  );
}

// =============================================================================
// Legacy API - For backward compatibility during migration
// =============================================================================

type UseApprovalCardsArgs = {
  pendingApprovals: ApprovalRequest[];
  approvalStatuses: Record<string, ApprovalStatus>;
  approvalLoading: Record<string, boolean>;
  setApprovalStatuses: Dispatch<SetStateAction<Record<string, ApprovalStatus>>>;
  setApprovalLoading: Dispatch<SetStateAction<Record<string, boolean>>>;
  clearApproval: (key: string) => void;
  resolveChatSessionId: (codexSessionId?: string) => string | null;
  selectedSessionId: string;
  setSessionNotices: Dispatch<SetStateAction<Record<string, SessionNotice | undefined>>>;
  t: TFunction;
};

/**
 * @deprecated Use useApprovalCardsFromStore instead
 */
export function useApprovalCards({
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
}: UseApprovalCardsArgs): ApprovalProps[] {
  const handleApprovalSelect = useCallback(
    async (request: ApprovalRequest, optionId: string) => {
      const key = `${request.sessionId}:${request.requestId}`;
      setApprovalLoading((prev) => ({ ...prev, [key]: true }));
      const optionKind =
        mapApprovalOptions(request.options).find((option) => option.id === optionId)?.kind ??
        'allow-once';
      const nextStatus = approvalStatusFromKind(optionKind);
      setApprovalStatuses((prev) => ({ ...prev, [key]: nextStatus }));
      try {
        await approveRequest(request.sessionId, request.requestId, undefined, optionId);
        setApprovalLoading((prev) => ({ ...prev, [key]: false }));
        window.setTimeout(() => {
          clearApproval(key);
        }, 900);
      } catch (err) {
        devDebug('[approval failed]', err);
        setApprovalLoading((prev) => ({ ...prev, [key]: false }));
        setApprovalStatuses((prev) => ({ ...prev, [key]: 'pending' }));
        const chatSessionId = resolveChatSessionId(request.sessionId);
        if (chatSessionId) {
          setSessionNotices((prev) => ({
            ...prev,
            [chatSessionId]: {
              kind: 'error',
              message: t('errors.approvalFailed', { error: formatError(err) }),
            },
          }));
        }
      }
    },
    [
      clearApproval,
      resolveChatSessionId,
      setApprovalLoading,
      setApprovalStatuses,
      setSessionNotices,
      t,
    ]
  );

  return useMemo(
    () =>
      pendingApprovals
        .filter((request) => resolveChatSessionId(request.sessionId) === selectedSessionId)
        .map((request) => {
          const toolCall = asRecord(request.toolCall) ?? {};
          const toolKind = normalizeToolKind(toolCall.kind);
          const type = toolKind === 'edit' ? 'patch' : 'exec';
          const title = getString(toolCall.title ?? toolCall.name) ?? t('approval.title');
          const description = extractApprovalDescription(toolCall);
          const command = extractCommand(toolCall.rawInput ?? toolCall.raw_input);
          const diffs = extractApprovalDiffs(toolCall);
          const options = mapApprovalOptions(request.options);
          const key = `${request.sessionId}:${request.requestId}`;

          return {
            callId: request.requestId,
            type,
            title,
            status: approvalStatuses[key] ?? 'pending',
            description,
            command,
            diffs: diffs.length > 0 ? diffs : undefined,
            options: options.length > 0 ? options : undefined,
            loading: approvalLoading[key] ?? false,
            onSelect: (_callId, optionId) => handleApprovalSelect(request, optionId),
          } satisfies ApprovalProps;
        }),
    [
      approvalLoading,
      approvalStatuses,
      handleApprovalSelect,
      pendingApprovals,
      resolveChatSessionId,
      selectedSessionId,
      t,
    ]
  );
}
