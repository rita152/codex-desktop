# Storybook (.storybook/)

## Scope

Applies to `.storybook/*` and Storybook-related test wiring.

## Overview

Storybook 10 with addon-vitest + addon-a11y. Stories are treated as a test surface (portable stories + Vitest).

## Where configuration lives

- Story discovery + addons: `.storybook/main.ts`
- Global preview environment (i18n + CSS variables): `.storybook/preview.ts`
- Vitest portable stories annotations: `.storybook/vitest.setup.ts`
- Vitest integration plugin wiring: `vite.config.ts` (`storybookTest({ configDir: '.storybook' })`)

## Conventions

- Stories live next to components: `src/**/*.stories.tsx` (see `.storybook/main.ts`).
- Prefer `tags: ['autodocs']`.
- a11y test mode is currently `todo` in `.storybook/preview.ts` (violations shown in UI, not CI-failing).

## Known deviations (keep consistent going forward)

- Some stories export multiple variants; prefer a single `Default` story going forward.
- Some story titles don't follow a single taxonomy (`UI/DataDisplay/*` vs `UI/Markdown` etc.).
