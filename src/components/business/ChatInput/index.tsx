import { useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { buildDefaultModels, DEFAULT_MODEL_ID } from '../../../constants/chat';

import { TextArea } from '../../ui/data-entry/TextArea';
import { IconButton } from '../../ui/data-entry/IconButton';
import { Select } from '../../ui/data-entry/Select';
import { Card } from '../../ui/data-display/Card';
import { RemainingButton } from '../../ui/feedback/RemainingButton';
import {
  PlusIcon,
  RobotIcon,
  SendIcon,
  ChatIcon,
  ForwardIcon,
  NotebookIcon,
} from '../../ui/data-display/Icon';
import { cn } from '../../../utils/cn';

import type { ChatInputProps } from './types';
import type { SelectOption } from '../../ui/data-entry/Select/types';

import './ChatInput.css';

const buildAgentOptions = (t: TFunction): SelectOption[] => [
  { value: 'chat', label: t('chatInput.agentOptions.chat'), icon: <ChatIcon size={18} /> },
  { value: 'agent', label: t('chatInput.agentOptions.agent'), icon: <RobotIcon size={18} /> },
  {
    value: 'agent-full',
    label: t('chatInput.agentOptions.agentFull'),
    icon: <ForwardIcon size={18} />,
  },
  {
    value: 'custom',
    label: t('chatInput.agentOptions.custom'),
    icon: <NotebookIcon size={18} />,
  },
];

export function ChatInput({
  value,
  onChange,
  onSend,
  onAddClick,
  placeholder = '',
  disabled = false,
  remainingPercent = 0,
  remainingTokens,
  totalTokens,
  onRemainingClick,
  remainingDisabled = false,
  agentOptions,
  selectedAgent = 'agent-full',
  onAgentChange,
  modelOptions,
  selectedModel = DEFAULT_MODEL_ID,
  onModelChange,
  slashCommands = [],
  width,
  className = '',
}: ChatInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const trimmedValue = value.trim();
  const defaultAgentOptions = useMemo(() => buildAgentOptions(t), [t]);
  const resolvedAgentOptions = useMemo(() => {
    const base = agentOptions ?? defaultAgentOptions;
    if (base.length === 0) return base;
    const iconMap = new Map(
      defaultAgentOptions.map((option) => [option.value, option.icon])
    );
    return base.map((option) => ({
      ...option,
      icon: option.icon ?? iconMap.get(option.value),
    }));
  }, [agentOptions, defaultAgentOptions]);
  const defaultModels = useMemo(() => buildDefaultModels(t), [t]);
  const resolvedModelOptions = modelOptions ?? defaultModels;

  const stripCommandSeparator = (tail: string) => (tail.startsWith(' ') ? tail.slice(1) : tail);

  const buildSlashCommandValue = (command: string, tail: string) => {
    if (tail.length === 0) return `/${command}`;
    const separator = /^\s/.test(tail) ? '' : ' ';
    return `/${command}${separator}${tail}`;
  };

  const normalizedSlashCommands = useMemo(() => {
    const cleaned = slashCommands.map((cmd) => cmd.trim().replace(/^\//, '')).filter(Boolean);
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
    const suggestions = normalizedSlashCommands.filter((cmd) => cmd.startsWith(query)).slice(0, 6);
    return {
      isActive: suggestions.length > 0,
      suggestions,
      leading,
      query,
    };
  }, [normalizedSlashCommands, value]);

  const leadingSlashToken = useMemo(() => {
    const match = value.match(/^\s*\/([^\s]+)([\s\S]*)$/);
    if (!match) return null;
    const command = match[1] ?? '';
    if (!command) return null;
    if (!normalizedSlashCommands.includes(command)) return null;
    const tail = match[2] ?? '';
    return { command, tail };
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
    if (trimmedValue === '/') return;
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
        setActiveSlashIndex((prev) => Math.min(prev + 1, slashState.suggestions.length - 1));
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
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const command = slashState.suggestions[activeSlashIndex] ?? slashState.suggestions[0];
        if (command) applySlashCommand(command);
        return;
      }
    }

    if (
      leadingSlashToken &&
      e.key === 'Backspace' &&
      e.currentTarget.selectionStart === 0 &&
      e.currentTarget.selectionEnd === 0
    ) {
      e.preventDefault();
      onChange(stripCommandSeparator(leadingSlashToken.tail));
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      trySend();
    }
  };

  const handleSend = () => {
    trySend();
  };

  const hasContent = trimmedValue.length > 0 && trimmedValue !== '/';

  const containerStyle: React.CSSProperties = width
    ? { width: typeof width === 'number' ? `${width}px` : width }
    : {};
  const containerClasses = cn('chat-input', className);

  return (
    <div className={containerClasses} style={containerStyle}>
      {leadingSlashToken ? (
        <div className="chat-input__textarea-row">
          <Card
            radius="full"
            background="secondary"
            bordered
            borderWidth="thin"
            padding="none"
            className="chat-input__slash-pill"
          >
            <span className="chat-input__slash-pill-text">/{leadingSlashToken.command}</span>
          </Card>
          <TextArea
            value={stripCommandSeparator(leadingSlashToken.tail)}
            onChange={(nextTail) => {
              onChange(buildSlashCommandValue(leadingSlashToken.command, nextTail));
            }}
            placeholder={placeholder}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            minRows={1}
            maxRows={6}
            className="chat-input__textarea chat-input__textarea--with-pill"
            ref={textareaRef}
          />
        </div>
      ) : (
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
      )}
      {slashState.isActive && (
        <div
          className="chat-input__slash-menu"
          role="listbox"
          aria-label={t('chatInput.slashAriaLabel')}
        >
          <div className="chat-input__slash-header">
            <span>{t('chatInput.slashTitle')}</span>
            <span className="chat-input__slash-hint">{t('chatInput.slashHint')}</span>
          </div>
          {slashState.suggestions.map((command, index) => {
            const isActive = index === activeSlashIndex;
            return (
              <button
                key={command}
                type="button"
                role="option"
                aria-selected={isActive}
                className={cn(
                  'chat-input__slash-item',
                  isActive && 'chat-input__slash-item--active'
                )}
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
            aria-label={t('common.add')}
            size="sm"
            variant="ghost"
            disabled={disabled || !onAddClick}
          />
          <Select
            options={resolvedAgentOptions}
            value={selectedAgent}
            onChange={onAgentChange}
            icon={<RobotIcon size={18} />}
            borderless
            size="sm"
            disabled={disabled}
            variant="glass"
            dropdownTitle={t('chatInput.switchMode')}
            aria-label={t('chatInput.selectAgent')}
          />
          <RemainingButton
            percent={remainingPercent}
            remainingTokens={remainingTokens}
            totalTokens={totalTokens}
            onClick={onRemainingClick}
            disabled={remainingDisabled || disabled}
            className="chat-input__remaining-button"
          />
        </div>
        <div className="chat-input__toolbar-right">
          <Select
            options={resolvedModelOptions}
            value={selectedModel}
            onChange={onModelChange}
            borderless
            size="sm"
            disabled={disabled}
            aria-label={t('chatInput.selectModel')}
          />
          <IconButton
            icon={<SendIcon size={20} />}
            onClick={handleSend}
            aria-label={t('common.send')}
            size="sm"
            variant="ghost"
            disabled={disabled || !hasContent}
            className={cn(
              'chat-input__send-button',
              hasContent && 'chat-input__send-button--active'
            )}
          />
        </div>
      </div>
    </div>
  );
}

export type { ChatInputProps } from './types';
