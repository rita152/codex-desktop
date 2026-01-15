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
  modelOptions?: SelectOption[];
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  slashCommands?: string[];
  remainingPercent?: number;
  remainingTokens?: number;
  totalTokens?: number;
  onRemainingClick?: () => void;
  remainingDisabled?: boolean;
  width?: string | number;
  className?: string;
}
