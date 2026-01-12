import { DEFAULT_MODELS } from '../../../constants/chat';

import { TextArea } from '../../ui/data-entry/TextArea';
import { IconButton } from '../../ui/data-entry/IconButton';
import { Select } from '../../ui/data-entry/Select';
import {
  PlusIcon,
  RobotIcon,
  SendIcon,
  ChatIcon,
  ForwardIcon,
  NotebookIcon,
} from '../../ui/data-display/Icon';

import type { ChatInputProps } from './types';
import type { SelectOption } from '../../ui/data-entry/Select/types';

import './ChatInput.css';

// Agent 选项带图标
const AGENT_OPTIONS: SelectOption[] = [
  { value: 'chat', label: 'Chat', icon: <ChatIcon size={18} /> },
  { value: 'agent', label: 'Agent', icon: <RobotIcon size={18} /> },
  { value: 'agent-full', label: 'Agent (full access)', icon: <ForwardIcon size={18} /> },
  { value: 'custom', label: 'Custom (config.toml)', icon: <NotebookIcon size={18} /> },
];

export function ChatInput({
  value,
  onChange,
  onSend,
  onAddClick,
  placeholder = '问问 olyx',
  disabled = false,
  agentOptions = AGENT_OPTIONS,
  selectedAgent = 'agent-full',
  onAgentChange,
  modelOptions = DEFAULT_MODELS,
  selectedModel = 'gpt-5.2-high',
  onModelChange,
  width,
  className = '',
}: ChatInputProps) {
  const trimmedValue = value.trim();

  const trySend = () => {
    if (disabled) return;
    if (!trimmedValue) return;
    onSend(trimmedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    const nativeEvent = e.nativeEvent as unknown as { isComposing?: boolean; keyCode?: number };
    const isComposing = nativeEvent.isComposing || nativeEvent.keyCode === 229;
    if (isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      trySend();
    }
  };

  const handleSend = () => {
    trySend();
  };

  const hasContent = trimmedValue.length > 0;

  const style: React.CSSProperties = width
    ? { width: typeof width === 'number' ? `${width}px` : width }
    : {};

  return (
    <div className={`chat-input ${className}`} style={style}>
      <TextArea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        minRows={1}
        maxRows={6}
        className="chat-input__textarea"
      />
      <div className="chat-input__toolbar">
        <div className="chat-input__toolbar-left">
          <IconButton
            icon={<PlusIcon size={20} />}
            onClick={onAddClick}
            aria-label="添加"
            size="sm"
            variant="ghost"
            disabled={disabled || !onAddClick}
          />
          <Select
            options={agentOptions}
            value={selectedAgent}
            onChange={onAgentChange}
            icon={<RobotIcon size={18} />}
            borderless
            size="sm"
            disabled={disabled}
            variant="glass"
            dropdownTitle="Switch mode"
            aria-label="选择智能体"
          />
        </div>
        <div className="chat-input__toolbar-right">
          <Select
            options={modelOptions}
            value={selectedModel}
            onChange={onModelChange}
            borderless
            size="sm"
            disabled={disabled}
            aria-label="选择模型"
          />
          <IconButton
            icon={<SendIcon size={20} />}
            onClick={handleSend}
            aria-label="发送"
            size="sm"
            variant="ghost"
            disabled={disabled || !hasContent}
            className={`chat-input__send-button ${hasContent ? 'chat-input__send-button--active' : ''}`}
          />
        </div>
      </div>
    </div>
  );
}

export type { ChatInputProps } from './types';
