export const DEFAULT_MODELS = [
  { value: 'gpt-5.2-high', label: 'gpt-5.2 (high)' },
  { value: 'gpt-5.2', label: 'gpt-5.2' },
  { value: 'gpt-4.1', label: 'gpt-4.1' },
];

export const DEFAULT_MODEL_ID = DEFAULT_MODELS[0]?.value ?? 'gpt-5.2-high';

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
