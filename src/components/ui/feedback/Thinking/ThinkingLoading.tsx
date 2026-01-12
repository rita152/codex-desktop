import { cn } from '../../../../utils/cn';

export interface ThinkingLoadingProps {
  className?: string;
}

export function ThinkingLoading({ className = '' }: ThinkingLoadingProps) {
  return (
    <div className={cn('thinking', 'thinking--streaming', className)}>
      <button type="button" className="thinking__trigger" disabled aria-label="Working">
        <span className="thinking__label">Working</span>
      </button>
    </div>
  );
}
