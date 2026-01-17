import { useCallback, useState } from 'react';

import type { ApprovalStatus } from '../components/ui/feedback/Approval';
import type { ApprovalRequest } from '../types/codex';

export function useApprovalState() {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, ApprovalStatus>>({});
  const [approvalLoading, setApprovalLoading] = useState<Record<string, boolean>>({});

  const registerApprovalRequest = useCallback((request: ApprovalRequest) => {
    const key = `${request.sessionId}:${request.requestId}`;
    setPendingApprovals((prev) => {
      const next = prev.filter((item) => `${item.sessionId}:${item.requestId}` !== key);
      return [...next, request];
    });
    setApprovalStatuses((prev) => ({ ...prev, [key]: 'pending' }));
    setApprovalLoading((prev) => ({ ...prev, [key]: false }));
  }, []);

  const clearApproval = useCallback((key: string) => {
    setPendingApprovals((prev) =>
      prev.filter((item) => `${item.sessionId}:${item.requestId}` !== key)
    );
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
    approvalLoading,
    setPendingApprovals,
    setApprovalStatuses,
    setApprovalLoading,
    registerApprovalRequest,
    clearApproval,
  };
}
