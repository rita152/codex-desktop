import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';

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

import type { ApprovalProps, ApprovalStatus } from '../components/ui/feedback/Approval';
import type { ApprovalRequest } from '../types/codex';
import type { SessionNotice } from './useSessionMeta';

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
