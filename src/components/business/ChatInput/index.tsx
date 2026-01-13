import { useEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_MODELS, DEFAULT_MODEL_ID } from '../../../constants/chat';

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
  placeholder = '',
  disabled = false,
  agentOptions = AGENT_OPTIONS,
  selectedAgent = 'agent-full',
  onAgentChange,
  modelOptions = DEFAULT_MODELS,
  selectedModel = DEFAULT_MODEL_ID,
  onModelChange,
  slashCommands = [],
  width,
  className = '',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const trimmedValue = value.trim();

  const normalizedSlashCommands = useMemo(() => {
    const cleaned = slashCommands
      .map((cmd) => cmd.trim().replace(/^\//, ''))
      .filter(Boolean);
    return Array.from(new Set(cleaned)).sort();
  }, [slashCommands]);

  const slashState = useMemo(() => {
    if (normalizedSlashCommands.length === 0) {
      return { isActive: false, suggestions: [], leading: '', query: '' };
    }
    const leadingMatch = value.match(/^\s*/);
    const leading = leadingMatch ? leadingMatch[0] : '';
    const trimmed = value.slice(leading.length);
    if (!trimmed.startsWith('/')) {
      return { isActive: false, suggestions: [], leading, query: '' };
    }
    const afterSlash = trimmed.slice(1);
    if (/\s/.test(afterSlash)) {
      return { isActive: false, suggestions: [], leading, query: '' };
    }
    const query = afterSlash;
    const suggestions = normalizedSlashCommands
      .filter((cmd) => cmd.startsWith(query))
      .slice(0, 6);
    return {
      isActive: suggestions.length > 0,
      suggestions,
      leading,
      query,
    };
  }, [normalizedSlashCommands, value]);

  useEffect(() => {
    setActiveSlashIndex(0);
  }, [slashState.query, slashState.suggestions.length]);

  const applySlashCommand = (command: string) => {
    const nextValue = `${slashState.leading}/${command} `;
    onChange(nextValue);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(nextValue.length, nextValue.length);
    });
  };

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

    if (slashState.isActive && slashState.suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSlashIndex((prev) =>
          Math.min(prev + 1, slashState.suggestions.length - 1)
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSlashIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const command = slashState.suggestions[activeSlashIndex] ?? slashState.suggestions[0];
        if (command) applySlashCommand(command);
        return;
      }
    }

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
        ref={textareaRef}
      />
      {slashState.isActive && (
        <div className="chat-input__slash-menu" role="listbox" aria-label="Slash commands">
          <div className="chat-input__slash-header">
            <span>Slash 命令</span>
            <span className="chat-input__slash-hint">Tab 自动补全</span>
          </div>
          {slashState.suggestions.map((command, index) => {
            const isActive = index === activeSlashIndex;
            return (
              <button
                key={command}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`chat-input__slash-item ${isActive ? 'chat-input__slash-item--active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applySlashCommand(command)}
              >
                <span className="chat-input__slash-command">/{command}</span>
              </button>
            );
          })}
        </div>
      )}
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
