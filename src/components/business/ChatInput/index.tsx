import { useMemo, useRef } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { TextArea } from '../../ui/data-entry/TextArea';
import { IconButton } from '../../ui/data-entry/IconButton';
import { Select } from '../../ui/data-entry/Select';
import { Card } from '../../ui/data-display/Card';
import { Button } from '../../ui/data-entry/Button';
import {
  PlusIcon,
  RobotIcon,
  SendIcon,
  ChatIcon,
  ForwardIcon,
  NotebookIcon,
} from '../../ui/data-display/Icon';
import { cn } from '../../../utils/cn';
import { useSlashCommands } from '../../../hooks/useSlashCommands';

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

const resolveAgentIcon = (
  option: SelectOption,
  defaultIconMap: Map<string, SelectOption['icon']>
) => {
  if (option.icon) return option.icon;
  const mapped = defaultIconMap.get(option.value);
  if (mapped) return mapped;
  const token = `${option.value ?? ''} ${option.label ?? ''}`.toLowerCase().replace(/_/g, ' ');
  if (/read\s*only|readonly|read-only/.test(token) || token.includes('chat')) {
    return <ChatIcon size={18} />;
  }
  if (/agent[-\s]*full|full\s*access|full-access/.test(token)) {
    return <ForwardIcon size={18} />;
  }
  if (token.includes('agent')) {
    return <RobotIcon size={18} />;
  }
  if (token.includes('custom') || token.includes('config')) {
    return <NotebookIcon size={18} />;
  }
  return undefined;
};

export function ChatInput({
  value,
  onChange,
  onSend,
  onAddClick,
  placeholder = '',
  disabled = false,
  agentOptions,
  selectedAgent = 'agent-full',
  onAgentChange,
  modelOptions,
  selectedModel,
  onModelChange,
  slashCommands = [],
  width,
  className = '',
}: ChatInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const trimmedValue = value.trim();
  const defaultAgentOptions = useMemo(() => buildAgentOptions(t), [t]);
  const resolvedAgentOptions = useMemo(() => {
    const base = agentOptions ?? defaultAgentOptions;
    if (base.length === 0) return base;
    const iconMap = new Map(defaultAgentOptions.map((option) => [option.value, option.icon]));
    return base.map((option) => ({
      ...option,
      icon: resolveAgentIcon(option, iconMap),
    }));
  }, [agentOptions, defaultAgentOptions]);
  // Model options are fetched from remote, no local fallback
  const resolvedModelOptions = modelOptions ?? [];

  const {
    activeIndex,
    setActiveIndex,
    slashState,
    leadingSlashToken,
    applySlashCommand,
    stripCommandSeparator,
    buildSlashCommandValue,
  } = useSlashCommands({
    value,
    slashCommands,
    onChange,
    textareaRef,
  });

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
        setActiveIndex((prev) => Math.min(prev + 1, slashState.suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const command = slashState.suggestions[activeIndex] ?? slashState.suggestions[0];
        if (command) applySlashCommand(command);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const command = slashState.suggestions[activeIndex] ?? slashState.suggestions[0];
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

  const hasContent = trimmedValue.length > 0 && trimmedValue !== '/';

  const containerStyle: React.CSSProperties = width
    ? { width: typeof width === 'number' ? `${width}px` : width }
    : {};
  const containerClasses = cn('chat-input', className);
  const textAreaValue = leadingSlashToken ? stripCommandSeparator(leadingSlashToken.tail) : value;
  const textAreaClassName = cn(
    'chat-input__textarea',
    leadingSlashToken && 'chat-input__textarea--with-pill'
  );
  const handleTextAreaChange = (nextValue: string) => {
    if (leadingSlashToken) {
      onChange(buildSlashCommandValue(leadingSlashToken.command, nextValue));
      return;
    }
    onChange(nextValue);
  };
  const textArea = (
    <TextArea
      value={textAreaValue}
      onChange={handleTextAreaChange}
      placeholder={placeholder}
      disabled={disabled}
      onKeyDown={handleKeyDown}
      minRows={1}
      maxRows={6}
      className={textAreaClassName}
      ref={textareaRef}
    />
  );

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
          {textArea}
        </div>
      ) : (
        textArea
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
            const isActive = index === activeIndex;
            return (
              <Button
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
              </Button>
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
        </div>
        <div className="chat-input__toolbar-right">
          <Select
            options={resolvedModelOptions}
            value={selectedModel}
            onChange={onModelChange}
            borderless
            size="sm"
            disabled={disabled}
            variant="glass"
            aria-label={t('chatInput.selectModel')}
          />
          <IconButton
            icon={<SendIcon size={20} />}
            onClick={trySend}
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
