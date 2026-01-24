export type PlanStatus = 'pending' | 'active' | 'completed' | 'error';

export interface PlanStep {
    id: string;
    title: string;
    description?: string;
    status: PlanStatus;
}

export interface PlanProps {
    className?: string;
    steps?: PlanStep[];
    title?: React.ReactNode;
}
