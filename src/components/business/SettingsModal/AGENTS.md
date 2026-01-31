# Settings (SettingsModal)

## Scope

Applies to `src/components/business/SettingsModal/**`.

## Overview

Settings UI is a modal orchestrator with form-like sections. Keep it as UI composition; persistence/platform boundaries live in hooks.

## Boundaries

- `SettingsModal.tsx` is the **orchestrator**: navigation/search, section routing, and wiring to hooks.
- `sections/*.tsx` are **form sections**: render controls, keep local UI state only, call `onUpdate(partial)`.
- **No new Tauri `invoke()` / `listen()` here.** If a setting needs IO/persistence, add it to `src/hooks/useSettings.ts` (or a new hook) and thread state down.

## Patterns

- Section props should look like: `{ settings, onUpdate }` (avoid sections self-loading/saving).
- Prefer CSS from `SettingsModal.css` + CSS variables; avoid hard-coded colors.
- Model-related UI is a separate domain (`src/components/business/ModelPanel/*`) and is lazy-loaded by the modal.

## Gotchas

- `sections/AdvancedSettings.tsx` currently performs app-level side effects (localStorage, reload, download). Treat that as a boundary exception; new actions should be callback-driven and implemented in hooks.

## Where to look

- Modal wiring + navigation/search: `SettingsModal.tsx`
- Shared skin/layout: `SettingsModal.css`
- Section registry/exports: `sections/index.ts`
- Settings data model + defaults: `src/types/settings.ts`
- Persistence + theme DOM side effects: `src/hooks/useSettings.ts`
