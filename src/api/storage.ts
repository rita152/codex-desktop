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

interface PersistedModelOptionsCache {
  version: number;
  updatedAt: number;
  options: PersistedModelOption[];
  currentModelId?: string;
}

interface PersistedModeOptionsCache {
  version: number;
  updatedAt: number;
  options: PersistedModelOption[];
  currentModeId?: string;
}

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

function normalizeModeOptions(raw: unknown): SelectOption[] {
  return normalizeModelOptions(raw);
}

export function loadModelOptionsCache(maxAgeMs: number = MODEL_CACHE_MAX_AGE_MS): {
  options: SelectOption[];
  currentModelId?: string;
  updatedAt: number;
} | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(MODEL_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedModelOptionsCache;
    if (!parsed || parsed.version !== MODEL_CACHE_VERSION) return null;
    if (typeof parsed.updatedAt !== 'number' || !Number.isFinite(parsed.updatedAt)) return null;
    if (Date.now() - parsed.updatedAt > maxAgeMs) return null;
    const options = normalizeModelOptions(parsed.options);
    if (options.length === 0) return null;
    const currentModelId =
      typeof parsed.currentModelId === 'string' && parsed.currentModelId.trim() !== ''
        ? parsed.currentModelId
        : undefined;
    return { options, currentModelId, updatedAt: parsed.updatedAt };
  } catch (err) {
    devDebug('[storage] Failed to load model options cache', err);
    return null;
  }
}

export function loadModeOptionsCache(maxAgeMs: number = MODE_CACHE_MAX_AGE_MS): {
  options: SelectOption[];
  currentModeId?: string;
  updatedAt: number;
} | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(MODE_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedModeOptionsCache;
    if (!parsed || parsed.version !== MODE_CACHE_VERSION) return null;
    if (typeof parsed.updatedAt !== 'number' || !Number.isFinite(parsed.updatedAt)) return null;
    if (Date.now() - parsed.updatedAt > maxAgeMs) return null;
    const options = normalizeModeOptions(parsed.options);
    if (options.length === 0) return null;
    const currentModeId =
      typeof parsed.currentModeId === 'string' && parsed.currentModeId.trim() !== ''
        ? parsed.currentModeId
        : undefined;
    return { options, currentModeId, updatedAt: parsed.updatedAt };
  } catch (err) {
    devDebug('[storage] Failed to load mode options cache', err);
    return null;
  }
}

export function saveModelOptionsCache(payload: {
  options: SelectOption[];
  currentModelId?: string;
}): void {
  if (typeof localStorage === 'undefined') return;

  const options: PersistedModelOption[] = payload.options
    .map((option) => ({
      value: String(option.value),
      label: String(option.label),
    }))
    .filter((option) => option.value.trim() !== '' && option.label.trim() !== '');

  if (options.length === 0) return;

  const persisted: PersistedModelOptionsCache = {
    version: MODEL_CACHE_VERSION,
    updatedAt: Date.now(),
    options,
    currentModelId:
      typeof payload.currentModelId === 'string' && payload.currentModelId.trim() !== ''
        ? payload.currentModelId
        : undefined,
  };

  try {
    localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify(persisted));
  } catch (err) {
    devDebug('[storage] Failed to save model options cache', err);
  }
}

export function saveModeOptionsCache(payload: {
  options: SelectOption[];
  currentModeId?: string;
}): void {
  if (typeof localStorage === 'undefined') return;

  const options: PersistedModelOption[] = payload.options
    .map((option) => ({
      value: String(option.value),
      label: String(option.label),
    }))
    .filter((option) => option.value.trim() !== '' && option.label.trim() !== '');

  if (options.length === 0) return;

  const persisted: PersistedModeOptionsCache = {
    version: MODE_CACHE_VERSION,
    updatedAt: Date.now(),
    options,
    currentModeId:
      typeof payload.currentModeId === 'string' && payload.currentModeId.trim() !== ''
        ? payload.currentModeId
        : undefined,
  };

  try {
    localStorage.setItem(MODE_CACHE_KEY, JSON.stringify(persisted));
  } catch (err) {
    devDebug('[storage] Failed to save mode options cache', err);
  }
}
