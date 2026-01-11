export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  onVoiceClick?: () => void;
  onAddClick?: () => void;
  placeholder?: string;
  disabled?: boolean;
  agentOptions?: { value: string; label: string }[];
  selectedAgent?: string;
  onAgentChange?: (agent: string) => void;
  modelOptions?: { value: string; label: string }[];
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  width?: string | number;
  className?: string;
}
