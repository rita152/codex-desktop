# Frontend Coding Standards

This document defines the required coding standards for the frontend codebase.
All new code and refactors must comply. Changes should be reviewed against
these rules to avoid future churn.

## 1) Goals

- Maintainability: code is easy to read, change, and test.
- Reliability: predictable behavior, strong typing, and consistent patterns.
- Accessibility: UI is usable via keyboard and screen readers.
- Performance: responsive UI with sensible memoization and rendering strategy.
- Security: safe handling of user input and external content.

## 2) Scope

Applies to all frontend code under `src/`:
- React components, hooks, utilities, styles, and tests.
- Storybook stories and tooling-related files that ship with the UI.

## 3) Tooling and Baseline

- TypeScript `strict` is required (see `tsconfig.json`).
- ESLint and Prettier must pass with no errors. Warnings are permitted only
  when explicitly documented and justified in code comments.
- Prefer running:
  - `npm run lint`
  - `npm run test:unit`
  - `npm run format` (check) as needed

## 4) Project Structure

Follow the existing structure:

- `src/components/business/` for feature-level components.
- `src/components/ui/` for reusable UI primitives.
- `src/hooks/` for custom hooks.
- `src/utils/` for pure utilities and helpers.
- `src/styles/` for global tokens and shared styling.
- `src/i18n/` for translations and formatting.

New components must live in the correct layer and follow existing naming and
folder conventions.

## 5) Naming Conventions

- Components: `PascalCase` file names and exports.
- Hooks: `useXxx` in `camelCase`.
- Utilities: `camelCase` for functions, `SCREAMING_SNAKE_CASE` for constants.
- CSS classes: `block__element--modifier` (BEM style as used in this repo).
- Boolean variables: `isOpen`, `hasContent`, `shouldRender`.

## 6) TypeScript Standards

- Avoid `any`. Use `unknown` when necessary and narrow explicitly.
- Use `type` for unions and `interface` for object shapes or public APIs.
- Prefer `satisfies` to validate object shapes without widening types.
- Use explicit return types for exported functions and hooks where clarity helps.
- `null` and `undefined` should be used intentionally; do not mix without reason.
- Use `Record<K, V>` over `{ [key: string]: V }` for dictionary-like objects.

## 7) React Component Standards

- Use function components and named exports.
- Keep components small; extract helpers when complexity grows.
- Avoid deriving state from props unless necessary. Prefer derived values via
  render or `useMemo`.
- Use `React.memo` only when a component is stable and measurable.
- Prefer `cn(...)` for className composition.
- Do not pass unstable object or function literals to deep children unless
  needed; use `useMemo`/`useCallback` for stabilization when relevant.

## 8) Hooks and Effects

- Hooks are called unconditionally and at the top level.
- Keep dependency arrays accurate; do not silence lint warnings without reason.
- Clean up side effects (`addEventListener`, timers, observers) in `useEffect`
  cleanup functions.
- Long-running async effects must handle cancellation via `AbortController` or
  stale-closure guards.
- Prefer `useRef` for mutable state that should not trigger re-renders.

## 9) Rendering and Lists

- Keys must be stable and derived from data, not array indices.
- Avoid rendering large lists without virtualization.
- Minimize re-renders by avoiding inline component definitions inside render
  unless necessary.

## 10) Accessibility (a11y)

- All interactive elements must be reachable by keyboard.
- Provide `aria-label` or visible labels for controls.
- Use semantic roles (`button`, `list`, `listbox`, `combobox`) appropriately.
- Ensure focus management for menus, dialogs, and input flows.
- Do not rely on color alone to convey meaning.

## 11) Styling Standards

- Use CSS classes only (no inline styles) except when dynamic sizing or
  layout requires runtime values.
- Use existing CSS variables in `src/styles/variables.css` for colors, spacing,
  and typography.
- Keep layout and presentation in CSS; avoid style logic in React except for
  minimal dynamic positioning.
- Avoid creating new global styles unless necessary.

## 12) i18n and Text

- All user-facing strings must go through `i18n` (`t('key')`).
- Translation keys should be stable and descriptive.
- Do not concatenate translated strings with raw text; use interpolation.

## 13) Logging

- Use `devDebug` for development-only logs.
- Avoid logging sensitive or user-provided data unless explicitly needed.
- Remove or guard debug logs before production builds.

## 14) Error Handling

- Catch async errors and convert to user-friendly messages.
- Prefer early returns to reduce nested conditionals.
- Ensure UI states are consistent when errors occur (no dangling spinners).

## 15) Security

- Avoid `dangerouslySetInnerHTML`.
- Sanitize any externally supplied HTML or markdown before rendering.
- Do not expose filesystem paths or system details to the UI unless required.

## 16) Performance

- Use memoization sparingly and only when it reduces measurable work.
- Avoid unnecessary state updates; use functional updates with care.
- Prefer lightweight calculations in render; move heavy work to memoized helpers.
- Keep reflow/paint triggers minimal for frequently updating UI.

## 17) Testing

- Unit tests for utilities and parsing logic are required.
- Storybook stories for UI components are required.
- For critical UI flows, add Vitest browser tests if possible.
- Tests should describe behavior, not implementation details.

## 18) Documentation

- Public APIs (components, hooks, utilities) should have clear JSDoc when usage
  or edge cases are non-obvious.
- Update this document when a new pattern is established across the codebase.

## 19) Change Checklist

Before merging:
- `npm run lint` passes with no errors.
- Tests for new or changed behavior are added or updated.
- UI changes have Storybook coverage when applicable.
- New patterns align with this standard or are documented.
