import type { PlanStep } from '../../../../types/plan';

export type { PlanStatus, PlanStep } from '../../../../types/plan';

export interface PlanProps {
  className?: string;
  steps?: PlanStep[];
  title?: React.ReactNode;
}
