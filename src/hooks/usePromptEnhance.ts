/**
 * Prompt Enhance Hook
 *
 * Provides one-shot prompt enhancement using an ephemeral Codex session.
 * Creates a temporary session, sends the prompt for optimization,
 * collects the response, and kills the session immediately.
 */

import { useState, useRef, useCallback } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import { createSession, sendPrompt, killSession } from '../api/codex';
import { devDebug } from '../utils/logger';

// Default system prompt for enhancement (can be overridden)
const DEFAULT_ENHANCE_SYSTEM_PROMPT = `You are a senior software engineer and prompt optimization specialist. Your task is to transform vague or incomplete coding requests into precise, actionable prompts that will yield better results from an AI coding assistant.

## Your Optimization Strategy

### 1. Clarify Intent
- Identify the core task (create, modify, fix, refactor, explain, etc.)
- Determine the scope (single file, module, feature, architecture)
- Infer the expected outcome

### 2. Add Technical Specificity
- Specify programming language, framework, or tech stack when inferable
- Include relevant patterns (REST API, React component, CLI tool, etc.)
- Mention coding conventions if context suggests them (TypeScript strict, ESLint, etc.)

### 3. Define Constraints & Requirements
- Add error handling expectations if dealing with I/O or async operations
- Include type safety requirements for typed languages
- Specify edge cases to consider when relevant

### 4. Structure for Actionability
- Break down complex requests into clear steps if beneficial
- Add acceptance criteria when the task has measurable outcomes
- Include "do not" constraints to prevent common pitfalls

## Output Rules

1. **Output ONLY the improved prompt** - no explanations, no preamble, no "Here's the improved version"
2. **Preserve the user's voice** - enhance, don't rewrite from scratch
3. **Keep it concise** - add value, not verbosity; aim for 2-3x the original length at most
4. **Match the original format** - if the user used bullet points, use bullet points; if prose, use prose
5. **Do not fabricate requirements** - only add constraints that are reasonable defaults or clearly inferable
6. **Language consistency** - respond in the same language as the input prompt

## Examples

Input: "add dark mode"
Output: "Add dark mode support to the application. Requirements:
- Implement a theme toggle (light/dark) that persists user preference
- Use CSS variables for theme colors to enable easy switching
- Respect system preference (prefers-color-scheme) as the default
- Ensure all components adapt to the selected theme"

Input: "fix the login bug"
Output: "Fix the login bug. Please:
1. First identify and describe the root cause of the issue
2. Implement the fix with proper error handling
3. Ensure the fix doesn't break existing authentication flows
4. Add appropriate logging for debugging future issues"

Input: "写一个文件上传功能"
Output: "实现文件上传功能，要求：
- 支持拖拽上传和点击选择文件
- 限制文件类型和大小，并给出友好的错误提示
- 显示上传进度条
- 处理上传失败的情况，支持重试
- 上传成功后返回文件信息（URL、大小、类型等）"

Now optimize the following prompt:`;

export interface UsePromptEnhanceOptions {
  /** Working directory for the session (defaults to '.') */
  cwd?: string;
  /** Custom system prompt for enhancement */
  systemPrompt?: string;
  /** Timeout in milliseconds (defaults to 30000) */
  timeout?: number;
}

export interface UsePromptEnhanceReturn {
  /** Enhance a prompt and return the optimized version */
  enhance: (prompt: string) => Promise<string | null>;
  /** Whether enhancement is in progress */
  isEnhancing: boolean;
  /** Last error message if enhancement failed */
  error: string | null;
  /** Cancel ongoing enhancement */
  cancel: () => void;
}

interface EnhanceState {
  sessionId: string | null;
  unlisteners: UnlistenFn[];
  chunks: string[];
  resolve: ((value: string | null) => void) | null;
  reject: ((reason: Error) => void) | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

/**
 * Hook for one-shot prompt enhancement.
 *
 * Usage:
 * ```tsx
 * const { enhance, isEnhancing, error, cancel } = usePromptEnhance();
 *
 * const handleEnhance = async () => {
 *   const result = await enhance(inputValue);
 *   if (result) setInputValue(result);
 * };
 * ```
 */
export function usePromptEnhance(options?: UsePromptEnhanceOptions): UsePromptEnhanceReturn {
  const {
    cwd = '.',
    systemPrompt = DEFAULT_ENHANCE_SYSTEM_PROMPT,
    timeout = 30000,
  } = options ?? {};

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to track ongoing enhancement state
  const stateRef = useRef<EnhanceState>({
    sessionId: null,
    unlisteners: [],
    chunks: [],
    resolve: null,
    reject: null,
    timeoutId: null,
  });

  // Cleanup function to kill session and remove listeners
  const cleanup = useCallback(async () => {
    const state = stateRef.current;

    // Clear timeout
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
    }

    // Remove event listeners
    for (const unlisten of state.unlisteners) {
      unlisten();
    }
    state.unlisteners = [];

    // Kill session if exists
    if (state.sessionId) {
      const sessionToKill = state.sessionId;
      state.sessionId = null;
      try {
        await killSession(sessionToKill);
        devDebug('[prompt-enhance] Session killed:', sessionToKill);
      } catch (err) {
        devDebug('[prompt-enhance] Failed to kill session:', err);
      }
    }

    // Reset state
    state.chunks = [];
    state.resolve = null;
    state.reject = null;
  }, []);

  // Cancel ongoing enhancement
  const cancel = useCallback(() => {
    const state = stateRef.current;
    if (state.resolve) {
      state.resolve(null);
    }
    void cleanup();
    setIsEnhancing(false);
  }, [cleanup]);

  // Main enhance function
  const enhance = useCallback(
    async (prompt: string): Promise<string | null> => {
      // Prevent concurrent enhancements
      if (isEnhancing) {
        return null;
      }

      // Validate input
      if (!prompt.trim()) {
        setError('Cannot enhance empty prompt');
        return null;
      }

      setIsEnhancing(true);
      setError(null);

      const state = stateRef.current;
      state.chunks = [];

      try {
        // 1. Create ephemeral session
        devDebug('[prompt-enhance] Creating ephemeral session...');
        const result = await createSession(cwd, true);
        state.sessionId = result.sessionId;
        devDebug('[prompt-enhance] Session created:', state.sessionId);

        // 2. Set up event listeners
        const enhancePromise = new Promise<string | null>((resolve, reject) => {
          state.resolve = resolve;
          state.reject = reject;

          // Set up timeout
          state.timeoutId = setTimeout(() => {
            reject(new Error('Enhancement timed out'));
          }, timeout);

          // Listen for message chunks
          const messageListener = listen<{ sessionId: string; text: string }>(
            'codex:message',
            (event) => {
              if (event.payload.sessionId === state.sessionId) {
                state.chunks.push(event.payload.text);
              }
            }
          );

          // Listen for turn complete
          const turnCompleteListener = listen<{ sessionId: string; stopReason: unknown }>(
            'codex:turn-complete',
            (event) => {
              if (event.payload.sessionId === state.sessionId) {
                const fullResponse = state.chunks.join('');
                devDebug('[prompt-enhance] Turn complete, response length:', fullResponse.length);
                resolve(fullResponse.trim() || null);
              }
            }
          );

          // Listen for errors
          const errorListener = listen<{ sessionId?: string; error?: string; message?: string }>(
            'codex:error',
            (event) => {
              // Check if this error is for our session or a general error
              const payload = event.payload;
              if (!payload.sessionId || payload.sessionId === state.sessionId) {
                const errorMsg = payload.error || payload.message || 'Unknown error';
                reject(new Error(errorMsg));
              }
            }
          );

          // Collect unlisteners
          Promise.all([messageListener, turnCompleteListener, errorListener]).then(
            (unlisteners) => {
              state.unlisteners = unlisteners;
            }
          );
        });

        // 3. Send enhance prompt
        const fullPrompt = `${systemPrompt}\n\n---\n\nOriginal prompt:\n${prompt}\n\n---\n\nImproved prompt:`;
        devDebug('[prompt-enhance] Sending prompt...');
        await sendPrompt(state.sessionId, fullPrompt);

        // 4. Wait for response
        const enhancedPrompt = await enhancePromise;

        // 5. Cleanup (kill session)
        await cleanup();
        setIsEnhancing(false);

        return enhancedPrompt;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Enhancement failed';
        devDebug('[prompt-enhance] Error:', errorMessage);
        setError(errorMessage);
        await cleanup();
        setIsEnhancing(false);
        return null;
      }
    },
    [isEnhancing, cwd, systemPrompt, timeout, cleanup]
  );

  return {
    enhance,
    isEnhancing,
    error,
    cancel,
  };
}
