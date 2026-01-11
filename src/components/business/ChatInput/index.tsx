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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend(value.trim());
      }
    }
  };

  const handleSend = () => {
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
            icon={<PlusIcon size={18} />}
            onClick={onAddClick}
            aria-label="添加"
            size="sm"
            variant="ghost"
          />
          <button type="button" className="chat-input__tool-button" onClick={onSettingsClick}>
            <SlidersIcon size={16} />
            工具
          </button>
          <Select
            options={agentOptions}
            value={selectedAgent}
            onChange={onAgentChange || (() => {})}
            icon={<RobotIcon size={16} />}
            borderless
            size="sm"
          />
        </div>
        <div className="chat-input__toolbar-right">
          <Select
            options={modelOptions}
            value={selectedModel}
            onChange={onModelChange || (() => {})}
            borderless
            size="sm"
          />
          <IconButton
            icon={<MicrophoneIcon size={18} />}
            onClick={onVoiceClick}
            aria-label="语音输入"
            size="sm"
            variant="ghost"
          />
          <IconButton
            icon={<SendIcon size={18} />}
            onClick={handleSend}
            aria-label="发送"
            size="sm"
            variant="ghost"
            disabled={!hasContent}
            className={`chat-input__send-button ${hasContent ? 'chat-input__send-button--active' : ''}`}
          />
        </div>
      </div>
    </div>
  );
}

export type { ChatInputProps } from './types';
