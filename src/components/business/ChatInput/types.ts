import type { SelectOption } from '../../ui/data-entry/Select/types';

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  onVoiceClick?: () => void;
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
  width?: string | number;
  className?: string;
}
