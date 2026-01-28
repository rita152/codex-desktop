# UI data-display components

## Scope

Applies to `src/components/ui/data-display/**`.

## Overview

Reusable, presentational display components (rendering/formatting). Keep them pure and predictable.

## Rules

- No backend calls, no event subscriptions, no app state.
- Prefer deterministic rendering from props.
- Expose `className` (and optionally `style`) for container-level customization.

## Styling

- Use semantic CSS variables (e.g. `--color-diff-*` for diffs).
- Avoid hard-coded colors.

## Accessibility

- `Icon` defaults to decorative (`aria-hidden`); interactive meaning must be provided by the parent control.

## Storybook

- Preferred title convention: `UI/DataDisplay/<Component>`.
- Existing titles like `UI/Markdown` / `UI/GitDiff` are legacy; avoid introducing new variants.

## Where to look

- Markdown rendering + styling: `Markdown/*`
- Diff rendering + theme variables: `GitDiff/*`
- SVG icon baseline: `Icon/*`
