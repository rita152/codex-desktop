import { memo, useCallback, useMemo, useRef } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { TextArea } from '../../ui/data-entry/TextArea';
import { IconButton } from '../../ui/data-entry/IconButton';
import { Select } from '../../ui/data-entry/Select';
import { ModelSelector } from '../../ui/data-entry/ModelSelector';
import { Card } from '../../ui/data-display/Card';
import { Button } from '../../ui/data-entry/Button';
import {
  PlusIcon,
  RobotIcon,
  SendIcon,
  ChatIcon,
  ForwardIcon,
  NotebookIcon,
  SparklesIcon,
  LoaderIcon,
  StopIcon,
} from '../../ui/data-display/Icon';
import { cn } from '../../../utils/cn';
import { useSlashCommands } from '../../../hooks/useSlashCommands';
import { usePromptEnhance } from '../../../hooks/usePromptEnhance';

import type { ChatInputProps } from './types';
import type { SelectOption } from '../../ui/data-entry/Select/types';

import './ChatInput.css';

// Pre-created icon elements to avoid recreating on each render
const ICON_CHAT_18 = <ChatIcon size={18} />;
const ICON_ROBOT_18 = <RobotIcon size={18} />;
const ICON_FORWARD_18 = <ForwardIcon size={18} />;
const ICON_NOTEBOOK_18 = <NotebookIcon size={18} />;
const ICON_CHAT_16 = <ChatIcon size={16} />;
const ICON_PLUS_20 = <PlusIcon size={20} />;
const ICON_SEND_20 = <SendIcon size={20} />;
const ICON_STOP_20 = <StopIcon size={20} />;
const ICON_SPARKLES_20 = <SparklesIcon size={20} />;
const ICON_LOADER_20 = <LoaderIcon size={20} />;

const buildAgentOptions = (t: TFunction): SelectOption[] => [
  { value: 'chat', label: t('chatInput.agentOptions.chat'), icon: ICON_CHAT_18 },
  { value: 'agent', label: t('chatInput.agentOptions.agent'), icon: ICON_ROBOT_18 },
  {
    value: 'agent-full',
    label: t('chatInput.agentOptions.agentFull'),
    icon: ICON_FORWARD_18,
  },
  {
    value: 'custom',
    label: t('chatInput.agentOptions.custom'),
    icon: ICON_NOTEBOOK_18,
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
    return ICON_CHAT_18;
  }
  if (/agent[-\s]*full|full\s*access|full-access/.test(token)) {
    return ICON_FORWARD_18;
  }
  if (token.includes('default')) {
    return ICON_ROBOT_18;
  }
  if (token.includes('agent')) {
    return ICON_ROBOT_18;
  }
  if (token.includes('custom') || token.includes('config')) {
    return ICON_NOTEBOOK_18;
  }
  return undefined;
};

export const ChatInput = memo(function ChatInput({
  value,
  onChange,
  onSend,
  onAddClick,
  placeholder = '',
  disabled = false,
  isGenerating = false,
  onCancel,
  agentOptions,
  selectedAgent = 'agent-full',
  onAgentChange,
  modelOptions,
  selectedModel,
  selectedEffort,
  onModelChange,
  slashCommands = [],
  width,
  className = '',
  onNavigatePrevious,
  onNavigateNext,
  onResetNavigation,
  contextRemainingPercent,
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

  // Prompt enhancement
  const { enhance, isEnhancing, error: enhanceError } = usePromptEnhance();

  const handleEnhancePrompt = useCallback(async () => {
    if (isEnhancing || !trimmedValue) return;
    const result = await enhance(trimmedValue);
    if (result) {
      onChange(result);
    }
  }, [isEnhancing, trimmedValue, enhance, onChange]);

  // Show error as a transient alert (simple implementation)
  // In production, you might want to use a toast or notice system
  useMemo(() => {
    if (enhanceError) {
      console.error('[prompt-enhance] Error:', enhanceError);
    }
  }, [enhanceError]);

  const trySend = useCallback(() => {
    if (disabled) return;
    if (!trimmedValue) return;
    if (trimmedValue === '/') return;
    onResetNavigation?.();
    onSend(trimmedValue);
  }, [disabled, trimmedValue, onResetNavigation, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

      // Prompt history navigation (only when not in slash command mode)
      // ArrowUp: Navigate to previous (older) prompt when cursor is at the start
      if (e.key === 'ArrowUp' && onNavigatePrevious) {
        const target = e.currentTarget;
        const isAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
        // Only navigate if cursor is at the very beginning or input is empty
        if (isAtStart || value.trim() === '') {
          e.preventDefault();
          const previousPrompt = onNavigatePrevious(value);
          if (previousPrompt !== null) {
            onChange(previousPrompt);
          }
          return;
        }
      }

      // ArrowDown: Navigate to next (newer) prompt when cursor is at the end
      if (e.key === 'ArrowDown' && onNavigateNext) {
        const target = e.currentTarget;
        const isAtEnd =
          target.selectionStart === target.value.length &&
          target.selectionEnd === target.value.length;
        // Only navigate if cursor is at the very end or input is empty
        if (isAtEnd || value.trim() === '') {
          e.preventDefault();
          const nextPrompt = onNavigateNext();
          if (nextPrompt !== null) {
            onChange(nextPrompt);
          }
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
    },
    [
      disabled,
      slashState.isActive,
      slashState.suggestions,
      activeIndex,
      setActiveIndex,
      applySlashCommand,
      onNavigatePrevious,
      onNavigateNext,
      value,
      onChange,
      leadingSlashToken,
      stripCommandSeparator,
      trySend,
    ]
  );

  const hasContent = trimmedValue.length > 0 && trimmedValue !== '/';

  const containerStyle: React.CSSProperties = width
    ? { width: typeof width === 'number' ? `${width}px` : width }
    : {};
  const containerClasses = cn('chat-input', className);
  const activeSlashIcon = useMemo(() => {
    if (!leadingSlashToken) return null;
    const match = resolvedAgentOptions.find((opt) => opt.value === leadingSlashToken.command);
    if (match) return match.icon;
    return ICON_CHAT_16;
  }, [leadingSlashToken, resolvedAgentOptions]);

  const textAreaValue = leadingSlashToken ? stripCommandSeparator(leadingSlashToken.tail) : value;
  const textAreaClassName = cn(
    'chat-input__textarea',
    leadingSlashToken && 'chat-input__textarea--with-pill'
  );
  const handleTextAreaChange = useCallback(
    (nextValue: string) => {
      if (leadingSlashToken) {
        onChange(buildSlashCommandValue(leadingSlashToken.command, nextValue));
        return;
      }
      onChange(nextValue);
    },
    [leadingSlashToken, onChange, buildSlashCommandValue]
  );

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
            radius="sm"
            background="default"
            bordered={false}
            padding="none"
            className="chat-input__slash-pill"
          >
            {activeSlashIcon && <span className="chat-input__slash-icon">{activeSlashIcon}</span>}
            <span className="chat-input__slash-pill-text">{leadingSlashToken.command}</span>
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
            icon={ICON_PLUS_20}
            onClick={onAddClick}
            aria-label={t('common.add')}
            size="sm"
            variant="ghost"
            disabled={disabled || !onAddClick}
          />
          <IconButton
            icon={isEnhancing ? ICON_LOADER_20 : ICON_SPARKLES_20}
            onClick={handleEnhancePrompt}
            aria-label={t('chatInput.enhancePrompt')}
            size="sm"
            variant="ghost"
            disabled={disabled || isEnhancing || !hasContent}
            className={cn(
              'chat-input__enhance-button',
              isEnhancing && 'chat-input__enhance-button--loading'
            )}
            title={enhanceError || t('chatInput.enhancePrompt')}
          />
          <Select
            options={resolvedAgentOptions}
            value={selectedAgent}
            onChange={onAgentChange}
            icon={ICON_ROBOT_18}
            borderless
            size="sm"
            disabled={disabled}
            variant="glass"
            dropdownTitle={t('chatInput.switchMode')}
            aria-label={t('chatInput.selectAgent')}
          />
          {contextRemainingPercent != null && (
            <div
              className={cn(
                'chat-input__context-ring',
                contextRemainingPercent < 20 && 'chat-input__context-ring--danger',
                contextRemainingPercent >= 20 &&
                  contextRemainingPercent < 40 &&
                  'chat-input__context-ring--warning'
              )}
              title={`${contextRemainingPercent}% left`}
            >
              <svg viewBox="0 0 20 20" className="chat-input__context-ring-svg">
                <circle
                  className="chat-input__context-ring-bg"
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  strokeWidth="2"
                />
                <circle
                  className="chat-input__context-ring-progress"
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  strokeWidth="2"
                  strokeDasharray={`${(contextRemainingPercent / 100) * 50.27} 50.27`}
                  strokeLinecap="round"
                  transform="rotate(-90 10 10)"
                />
              </svg>
              <span className="chat-input__context-ring-tooltip">
                {contextRemainingPercent}% left
              </span>
            </div>
          )}
        </div>
        <div className="chat-input__toolbar-right">
          <ModelSelector
            options={resolvedModelOptions}
            selectedModel={selectedModel}
            selectedEffort={selectedEffort}
            onChange={onModelChange}
            borderless
            size="sm"
            disabled={disabled}
            variant="glass"
            aria-label={t('chatInput.selectModel')}
          />
          <IconButton
            icon={isGenerating ? ICON_STOP_20 : ICON_SEND_20}
            onClick={isGenerating ? onCancel : trySend}
            aria-label={isGenerating ? t('common.cancel') : t('common.send')}
            size="sm"
            variant="ghost"
            disabled={disabled || (!isGenerating && !hasContent)}
            className={cn(
              'chat-input__send-button',
              !isGenerating && hasContent && 'chat-input__send-button--active',
              isGenerating && 'chat-input__send-button--generating'
            )}
          />
        </div>
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export type { ChatInputProps } from './types';
