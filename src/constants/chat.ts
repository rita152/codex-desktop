import type { TFunction } from 'i18next';

const DEFAULT_MODEL_OPTIONS = [
  { value: 'gpt-5.2-high', labelKey: 'gpt52High', defaultLabel: 'gpt-5.2 (high)' },
  { value: 'gpt-5.2', labelKey: 'gpt52', defaultLabel: 'gpt-5.2' },
  { value: 'gpt-4.1', labelKey: 'gpt41', defaultLabel: 'gpt-4.1' },
] as const;

export const DEFAULT_MODEL_ID = DEFAULT_MODEL_OPTIONS[0]?.value ?? 'gpt-5.2-high';

export const buildDefaultModels = (t: TFunction): Array<{ value: string; label: string }> =>
  DEFAULT_MODEL_OPTIONS.map((option) => ({
    value: option.value,
    label: t(`models.${option.labelKey}`, { defaultValue: option.defaultLabel }),
  }));

// Keep in sync with codex-acp built-in commands.
export const DEFAULT_SLASH_COMMANDS = [
  'review',
  'review-branch',
  'review-commit',
  'init',
  'compact',
  'undo',
  'logout',
];
