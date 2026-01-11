import { TextArea } from '../../ui/data-entry/TextArea';
import { IconButton } from '../../ui/data-entry/IconButton';
import { Select } from '../../ui/data-entry/Select';
import {
  PlusIcon,
  SlidersIcon,
  RobotIcon,
  MicrophoneIcon,
  SendIcon,
} from '../../ui/data-display/Icon';
import { DEFAULT_AGENTS, DEFAULT_MODELS } from '../../../constants/chat';

import type { ChatInputProps } from './types';

import './ChatInput.css';

export function ChatInput({
  value,
  onChange,
  onSend,
  onVoiceClick,
  onAddClick,
  onSettingsClick,
  placeholder = '问问 olyx',
  disabled = false,
  agentOptions = DEFAULT_AGENTS,
  selectedAgent = 'agent',
  onAgentChange,
  modelOptions = DEFAULT_MODELS,
  selectedModel = 'gpt-5.2-high',
  onModelChange,
  width,
  className = '',
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    const nativeEvent = e.nativeEvent as unknown as { isComposing?: boolean; keyCode?: number };
    const isComposing = nativeEvent.isComposing || nativeEvent.keyCode === 229;
    if (isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend(value.trim());
      }
    }
  };

  const handleSend = () => {
    if (disabled) return;
    if (value.trim()) {
      onSend(value.trim());
    }
  };

  const hasContent = value.trim().length > 0;

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
          <button
            type="button"
            className="chat-input__tool-button"
            onClick={onSettingsClick}
            disabled={disabled || !onSettingsClick}
          >
            <SlidersIcon size={18} />
            <span className="chat-input__tool-text">工具</span>
          </button>
          <Select
            options={agentOptions}
            value={selectedAgent}
            onChange={onAgentChange}
            icon={<RobotIcon size={18} />}
            borderless
            size="sm"
            disabled={disabled}
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
            icon={<MicrophoneIcon size={20} />}
            onClick={onVoiceClick}
            aria-label="语音输入"
            size="sm"
            variant="ghost"
            disabled={disabled || !onVoiceClick}
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
