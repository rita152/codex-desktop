export interface SelectOption {
  value: string;
  label: string;
}

/** Reasoning effort level */
export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/** Reasoning effort option with description */
export interface ReasoningEffortOption {
  effort: ReasoningEffort;
  description: string;
}

/** Extended model option with reasoning effort support */
export interface ModelOption extends SelectOption {
  /** Model's default reasoning effort level */
  defaultReasoningEffort?: ReasoningEffort;
  /** Supported reasoning effort options for this model */
  supportedReasoningEfforts?: ReasoningEffortOption[];
  /** Whether model supports personality instructions */
  supportsPersonality?: boolean;
}
