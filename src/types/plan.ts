export type PlanStatus = 'pending' | 'active' | 'completed' | 'error';

export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  status: PlanStatus;
}
