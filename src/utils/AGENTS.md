# Frontend utilities (src/utils/)

## Overview

Pure helpers used across UI/business/hooks. This is a high-impact area: small changes can affect many screens.

## Hotspots

- `codexParsing.ts`: protocol/DTO normalization and compatibility (camelCase/snake_case, fallbacks).
- `remotePath.ts`: `remote://<server-id>/<path>` parsing/building.
- `chatGroups.ts`: grouping messages/approvals for rendering.

## Rules

- Prefer pure functions; avoid side effects.
- Changes to protocol parsing must be backward-compatible unless coordinated with the Rust side.
- Add/adjust tests when changing parsing/grouping behavior.
