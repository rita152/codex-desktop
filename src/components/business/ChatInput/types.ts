import type { ModelOption, ReasoningEffort } from '../../../types/options';
import type { SelectOption } from '../../ui/data-entry/Select/types';

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  onAddClick?: () => void;
  placeholder?: string;
  disabled?: boolean;
  agentOptions?: SelectOption[];
  selectedAgent?: string;
  onAgentChange?: (agent: string) => void;
  /** Model options with reasoning effort support */
  modelOptions?: ModelOption[];
  selectedModel?: string;
  /** Currently selected reasoning effort */
  selectedEffort?: ReasoningEffort;
  /** Callback when model or effort changes */
  onModelChange?: (model: string, effort?: ReasoningEffort) => void;
  slashCommands?: string[];
  width?: string | number;
  className?: string;
  /**
   * Called when user presses ArrowUp to navigate to previous prompt.
   * Should return the previous prompt or null if none available.
   */
  onNavigatePrevious?: (currentValue: string) => string | null;
  /**
   * Called when user presses ArrowDown to navigate to next prompt.
   * Should return the next prompt or null if none available.
   */
  onNavigateNext?: () => string | null;
  /**
   * Called when navigation should be reset (e.g., on send).
   */
  onResetNavigation?: () => void;
}
