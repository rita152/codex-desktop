// Model list is fetched from remote, no hardcoded options.
// DEFAULT_MODEL_ID is used as a fallback for session initialization only.
export const DEFAULT_MODEL_ID = 'gpt-5.2-high';
export const DEFAULT_MODE_ID = 'agent-full';

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
