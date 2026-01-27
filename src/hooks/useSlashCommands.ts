import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';

type SlashState = {
  isActive: boolean;
  suggestions: string[];
  leading: string;
  query: string;
};

type LeadingSlashToken = {
  command: string;
  tail: string;
} | null;

type UseSlashCommandsArgs = {
  value: string;
  slashCommands: string[];
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

const stripCommandSeparator = (tail: string) => (tail.startsWith(' ') ? tail.slice(1) : tail);

const buildSlashCommandValue = (command: string, tail: string) => {
  if (tail.length === 0) return `/${command}`;
  const separator = /^\s/.test(tail) ? '' : ' ';
  return `/${command}${separator}${tail}`;
};

export function useSlashCommands({
  value,
  slashCommands,
  onChange,
  textareaRef,
}: UseSlashCommandsArgs) {
  const [activeIndex, setActiveIndex] = useState(0);

  const normalizedSlashCommands = useMemo(() => {
    const cleaned = slashCommands.map((cmd) => cmd.trim().replace(/^\//, '')).filter(Boolean);
    return Array.from(new Set(cleaned)).sort();
  }, [slashCommands]);

  const slashState = useMemo<SlashState>(() => {
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

  const leadingSlashToken = useMemo<LeadingSlashToken>(() => {
    const match = value.match(/^\s*\/([^\s]+)([\s\S]*)$/);
    if (!match) return null;
    const command = match[1] ?? '';
    if (!command) return null;
    if (!normalizedSlashCommands.includes(command)) return null;
    const tail = match[2] ?? '';
    return { command, tail };
  }, [normalizedSlashCommands, value]);

  useEffect(() => {
    setActiveIndex(0);
  }, [slashState.query, slashState.suggestions.length]);

  const applySlashCommand = useCallback(
    (command: string) => {
      const nextValue = `${slashState.leading}/${command} `;
      onChange(nextValue);
      requestAnimationFrame(() => {
        const node = textareaRef.current;
        if (!node) return;
        node.focus();
        node.setSelectionRange(nextValue.length, nextValue.length);
      });
    },
    [onChange, slashState.leading, textareaRef]
  );

  const safeStripCommandSeparator = useCallback((tail: string) => stripCommandSeparator(tail), []);
  const safeBuildSlashCommandValue = useCallback(
    (command: string, tail: string) => buildSlashCommandValue(command, tail),
    []
  );

  return {
    activeIndex,
    setActiveIndex,
    normalizedSlashCommands,
    slashState,
    leadingSlashToken,
    applySlashCommand,
    stripCommandSeparator: safeStripCommandSeparator,
    buildSlashCommandValue: safeBuildSlashCommandValue,
  };
}
