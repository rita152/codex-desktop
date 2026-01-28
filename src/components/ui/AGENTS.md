# UI components (src/components/ui/)

## Overview

Reusable presentational components. Keep them pure.

## Rules

- No business logic, no `invoke()`, no event subscriptions.
- Props in `types.ts` when non-trivial; re-export types from `index.tsx` when useful.
- Provide a Storybook story for new components.

## Styling

- Use CSS variables (`var(--color-...)`).
- Prefer consistent class naming (BEM-style is common in this repo).
