# Settings sections (SettingsModal/sections)

## Scope

Applies to `src/components/business/SettingsModal/sections/*`.

## Contract

- Sections are **pure-ish form UI**.
- Preferred signature: `({ settings, onUpdate })`.
- `onUpdate` should emit **partial** updates for that section; persistence is handled elsewhere.

## Allowed

- Local UI state for interaction (e.g. shortcut recording).
- Small immediate side effects that are UI-only (e.g. `i18n.changeLanguage`) — document if you add any.

## Forbidden

- New Tauri boundary calls (`invoke`, `listen`).
- Writing to storage / triggering app reloads directly (route via callbacks to a hook/service).

## Stories

- Keep a section story next to the section.
- Use the shared story wrapper CSS: `SettingsSection.stories.css`.
- Import `../SettingsModal.css` in section stories to match the real skin.

## Where to look

- Typical section shape: `GeneralSettings.tsx`, `ShortcutSettings.tsx`
- Embedded domain section: `RemoteSettings.tsx` (wraps `RemoteServerManager`)
