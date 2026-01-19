import type { SelectOption } from '../components/ui/data-entry/Select/types';
import { devDebug } from '../utils/logger';

const MODEL_CACHE_KEY = 'codex-desktop.model-options';
const MODEL_CACHE_VERSION = 1;
const MODEL_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MODE_CACHE_KEY = 'codex-desktop.mode-options';
const MODE_CACHE_VERSION = 1;
const MODE_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface PersistedModelOption {
  value: string;
  label: string;
}

type PersistedOptionsCache<K extends string> = {
  version: number;
  updatedAt: number;
  options: PersistedModelOption[];
} & Partial<Record<K, string>>;

function normalizeModelOptions(raw: unknown): SelectOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as { value?: unknown; label?: unknown };
      const value = typeof record.value === 'string' ? record.value.trim() : '';
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      if (!value || !label) return null;
      return { value, label } satisfies SelectOption;
    })
    .filter(Boolean) as SelectOption[];
}

function normalizeCurrentId(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : undefined;
}

function serializeOptions(options: SelectOption[]): PersistedModelOption[] {
  return options
    .map((option) => ({
      value: String(option.value),
      label: String(option.label),
    }))
    .filter((option) => option.value.trim() !== '' && option.label.trim() !== '');
}

type CacheLoadResult = {
  options: SelectOption[];
  currentId?: string;
  updatedAt: number;
};

type CacheConfig<K extends string> = {
  key: string;
  version: number;
  maxAgeMs: number;
  currentIdKey: K;
};

function loadOptionsCache<K extends string>({
  key,
  version,
  maxAgeMs,
  currentIdKey,
}: CacheConfig<K>): CacheLoadResult | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedOptionsCache<K>;
    if (!parsed || parsed.version !== version) return null;
    if (typeof parsed.updatedAt !== 'number' || !Number.isFinite(parsed.updatedAt)) return null;
    if (Date.now() - parsed.updatedAt > maxAgeMs) return null;
    const options = normalizeModelOptions(parsed.options);
    if (options.length === 0) return null;
    const currentId = normalizeCurrentId(parsed[currentIdKey]);
    return { options, currentId, updatedAt: parsed.updatedAt };
  } catch (err) {
    devDebug(`[storage] Failed to load ${currentIdKey} cache`, err);
    return null;
  }
}

type CacheSaveArgs<K extends string> = {
  key: string;
  version: number;
  options: SelectOption[];
  currentIdKey: K;
  currentId?: string;
};

function saveOptionsCache<K extends string>({
  key,
  version,
  options,
  currentIdKey,
  currentId,
}: CacheSaveArgs<K>): void {
  if (typeof localStorage === 'undefined') return;

  const serializedOptions = serializeOptions(options);
  if (serializedOptions.length === 0) return;

  const persisted = {
    version,
    updatedAt: Date.now(),
    options: serializedOptions,
  } as PersistedOptionsCache<K>;
  const normalizedCurrentId = normalizeCurrentId(currentId);
  if (normalizedCurrentId) {
    (persisted as Record<K, string>)[currentIdKey] = normalizedCurrentId;
  }

  try {
    localStorage.setItem(key, JSON.stringify(persisted));
  } catch (err) {
    devDebug(`[storage] Failed to save ${currentIdKey} cache`, err);
  }
}

export function loadModelOptionsCache(maxAgeMs: number = MODEL_CACHE_MAX_AGE_MS): {
  options: SelectOption[];
  currentModelId?: string;
  updatedAt: number;
} | null {
  const result = loadOptionsCache({
    key: MODEL_CACHE_KEY,
    version: MODEL_CACHE_VERSION,
    maxAgeMs,
    currentIdKey: 'currentModelId',
  });
  if (!result) return null;
  return { options: result.options, currentModelId: result.currentId, updatedAt: result.updatedAt };
}

export function loadModeOptionsCache(maxAgeMs: number = MODE_CACHE_MAX_AGE_MS): {
  options: SelectOption[];
  currentModeId?: string;
  updatedAt: number;
} | null {
  const result = loadOptionsCache({
    key: MODE_CACHE_KEY,
    version: MODE_CACHE_VERSION,
    maxAgeMs,
    currentIdKey: 'currentModeId',
  });
  if (!result) return null;
  return { options: result.options, currentModeId: result.currentId, updatedAt: result.updatedAt };
}

export function saveModelOptionsCache(payload: {
  options: SelectOption[];
  currentModelId?: string;
}): void {
  saveOptionsCache({
    key: MODEL_CACHE_KEY,
    version: MODEL_CACHE_VERSION,
    options: payload.options,
    currentIdKey: 'currentModelId',
    currentId: payload.currentModelId,
  });
}

export function saveModeOptionsCache(payload: {
  options: SelectOption[];
  currentModeId?: string;
}): void {
  saveOptionsCache({
    key: MODE_CACHE_KEY,
    version: MODE_CACHE_VERSION,
    options: payload.options,
    currentIdKey: 'currentModeId',
    currentId: payload.currentModeId,
  });
}
