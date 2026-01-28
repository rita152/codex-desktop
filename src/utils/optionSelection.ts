import type { SelectOption } from '../types/options';

type ResolveOptionArgs = {
  preferredId?: string;
  availableOptions?: SelectOption[];
  fallbackIds?: Array<string | undefined>;
  defaultId: string;
};

export function resolveOptionId({
  preferredId,
  availableOptions,
  fallbackIds = [],
  defaultId,
}: ResolveOptionArgs): string {
  const options = availableOptions ?? [];
  const hasOptions = options.length > 0;
  const available = hasOptions ? new Set(options.map((option) => option.value)) : null;
  let desired = preferredId;

  if (hasOptions && desired && !available?.has(desired)) {
    desired = undefined;
  }

  if (!desired) {
    for (const candidate of fallbackIds) {
      if (!candidate) continue;
      if (!hasOptions || available?.has(candidate)) {
        desired = candidate;
        break;
      }
    }
  }

  return desired ?? options[0]?.value ?? defaultId;
}

type SyncOptionArgs = {
  desiredId?: string;
  currentId?: string;
  availableOptions?: SelectOption[];
};

export function shouldSyncOption({
  desiredId,
  currentId,
  availableOptions,
}: SyncOptionArgs): boolean {
  if (!desiredId) return false;
  if (currentId && desiredId === currentId) return false;
  if (!availableOptions || availableOptions.length === 0) return true;
  return availableOptions.some((option) => option.value === desiredId);
}
