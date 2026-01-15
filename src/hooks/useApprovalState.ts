import { useCallback, useState } from 'react';

import type { ApprovalStatus } from '../components/ui/feedback/Approval';
import type { ApprovalRequest } from '../types/codex';

export function useApprovalState() {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, ApprovalStatus>>({});
  const [approvalFeedback, setApprovalFeedback] = useState<Record<string, string>>({});
  const [approvalLoading, setApprovalLoading] = useState<Record<string, boolean>>({});

  const registerApprovalRequest = useCallback((request: ApprovalRequest) => {
    const key = `${request.sessionId}:${request.requestId}`;
    setPendingApprovals((prev) => {
      const next = prev.filter((item) => `${item.sessionId}:${item.requestId}` !== key);
      return [...next, request];
    });
    setApprovalStatuses((prev) => ({ ...prev, [key]: 'pending' }));
    setApprovalFeedback((prev) => ({ ...prev, [key]: prev[key] ?? '' }));
    setApprovalLoading((prev) => ({ ...prev, [key]: false }));
  }, []);

  const clearApproval = useCallback((key: string) => {
    setPendingApprovals((prev) =>
      prev.filter((item) => `${item.sessionId}:${item.requestId}` !== key)
    );
    setApprovalFeedback((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setApprovalLoading((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setApprovalStatuses((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  return {
    pendingApprovals,
    approvalStatuses,
    approvalFeedback,
    approvalLoading,
    setPendingApprovals,
    setApprovalStatuses,
    setApprovalFeedback,
    setApprovalLoading,
    registerApprovalRequest,
    clearApproval,
  };
}
