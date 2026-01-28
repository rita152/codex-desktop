# UI data-entry components

## Scope

Applies to `src/components/ui/data-entry/**`.

## Overview

Reusable, presentational input components. Keep them controlled-friendly and accessible.

## Patterns

- Prefer controlled surfaces: `value` + `onChange(nextValue)`.
- Forward native props to the underlying element when practical.
- Default `className = ''` and append via `cn(...)`.

## Accessibility

- Icon-only controls must require an accessible label (`aria-label` / `aria-labelledby`).
- Select-like controls should follow WAI-ARIA patterns (use `Select/` as the reference implementation).

## Styling

- Use CSS variables only; no hard-coded colors.
- Use BEM-style classes and modifier classes for `size`/`variant`.
- If using portals/overlays, be explicit about layering (z-index) and document it.

## Storybook

- Title convention: `UI/DataEntry/<Component>`.
- Prefer a single `Default` story with `argTypes` (unless an exception is documented).

## Where to look

- A11y + portal dropdown: `Select/*`
- Controlled textarea + auto-resize: `TextArea/*`
- Icon-only button + aria-label: `IconButton/*`
