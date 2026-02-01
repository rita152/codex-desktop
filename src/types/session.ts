import type { ReasoningEffort } from './options';

export interface ChatSession {
  id: string;
  title: string;
  cwd?: string;
  model?: string;
  mode?: string;
  /** Current reasoning effort level for the model */
  reasoningEffort?: ReasoningEffort;
}
