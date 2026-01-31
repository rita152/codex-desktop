import type { ModelOption, ReasoningEffort } from '../../../../types/options';

export interface ModelSelectorProps {
  /** Available model options */
  options: ModelOption[];
  /** Currently selected model ID */
  selectedModel?: string;
  /** Currently selected reasoning effort */
  selectedEffort?: ReasoningEffort;
  /** Callback when model or effort changes */
  onChange?: (modelId: string, effort?: ReasoningEffort) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show border */
  borderless?: boolean;
  /** Dropdown style variant */
  variant?: 'default' | 'glass';
  /** Accessible label */
  'aria-label': string;
}
