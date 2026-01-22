import { useCallback, useEffect, useState } from 'react';

import { authCodex, createSession, loadCodexCliConfig, setCodexEnv } from '../api/codex';
import { formatError, resolveModelOptions } from '../utils/codexParsing';

import type { CodexCliConfigInfo } from '../types/codex';
import type { SelectOption } from '../components/ui/data-entry/Select/types';

export type ModelFetchResult = {
  options: SelectOption[];
  currentId?: string;
};

type FetchState = {
  loadingConfig: boolean;
  configError?: string;
  config?: CodexCliConfigInfo;
  fetching: boolean;
  fetchError?: string;
  lastFetchedAt?: Date;
};

const resolveAuthMethod = (providerId?: string): string | null => {
  if (!providerId) return null;
  const normalized = providerId.toLowerCase();
  if (normalized.includes('codex')) return 'codex-api-key';
  if (normalized.includes('openai')) return 'openai-api-key';
  return null;
};

export function useModelFetch() {
  const [state, setState] = useState<FetchState>({
    loadingConfig: true,
    fetching: false,
  });

  const loadConfig = useCallback(async () => {
    setState((prev) => ({ ...prev, loadingConfig: true, configError: undefined }));
    try {
      const config = await loadCodexCliConfig();
      setState((prev) => ({
        ...prev,
        config,
        loadingConfig: false,
      }));
      return config;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loadingConfig: false,
        configError: formatError(err),
      }));
      return undefined;
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const fetchModels = useCallback(
    async ({ apiKey, cwd = '.' }: { apiKey?: string; cwd?: string }) => {
      setState((prev) => ({ ...prev, fetching: true, fetchError: undefined }));
      try {
        const config = state.config ?? (await loadConfig());
        const envKey = config?.envKey?.trim();
        if (envKey && apiKey) {
          await setCodexEnv(envKey, apiKey);
        }
        const authMethod = resolveAuthMethod(config?.modelProvider);
        if (authMethod && apiKey) {
          await authCodex(authMethod, apiKey);
        }
        const result = await createSession(cwd);
        const modelState = resolveModelOptions(result.models, result.configOptions);
        const options = modelState?.options ?? [];
        const currentId = modelState?.currentModelId;
        if (options.length === 0) {
          throw new Error('No models returned');
        }
        setState((prev) => ({
          ...prev,
          fetching: false,
          lastFetchedAt: new Date(),
        }));
        return { options, currentId } satisfies ModelFetchResult;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          fetching: false,
          fetchError: formatError(err),
        }));
        throw err;
      }
    },
    [loadConfig, state.config]
  );

  return {
    config: state.config,
    loadingConfig: state.loadingConfig,
    configError: state.configError,
    fetching: state.fetching,
    fetchError: state.fetchError,
    lastFetchedAt: state.lastFetchedAt,
    reloadConfig: loadConfig,
    fetchModels,
  };
}
