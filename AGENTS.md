# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the React + TypeScript frontend. Look in `src/components/ui` for reusable UI pieces and `src/components/business` for app-specific views.
- `src-tauri/` is the Rust backend for Tauri. Core logic lives in `src-tauri/src`, with `tauri.conf.json` for app configuration.
- `docs/` contains project documentation and assets (e.g., `docs/screenshot.png`).
- `.storybook/` stores Storybook configuration and stories for UI development.

## Build, Test, and Development Commands
- `npm install`: install JS dependencies.
- `npm run dev`: run the Vite frontend dev server only.
- `npm run tauri dev`: run the full desktop app (Vite + Tauri).
- `npm run storybook`: launch Storybook for component development.
- `npm run build`: run the TypeScript build check.
- `npm run tauri build`: produce a production desktop build.
- `npm run test`: run the frontend test suite.
- `cargo test` (from `src-tauri/`): run backend Rust tests.

## Coding Style & Naming Conventions
- TypeScript follows standard React + Vite conventions; prefer clear, descriptive component names in PascalCase (e.g., `ChatPanel.tsx`).
- Rust follows `snake_case` for functions/modules and `PascalCase` for types.
- Use existing lint/format tooling where configured; do not reformat unrelated files.

## Testing Guidelines
- Frontend tests run via `npm run test` (Vitest configuration lives in `vitest.unit.config.ts`).
- Rust backend tests run with `cargo test` under `src-tauri/`.
- Keep tests focused and name them after the behavior they validate (e.g., `renders_empty_state`).

## Commit & Pull Request Guidelines
- Recent commits use short, imperative summaries (e.g., “Optimize chat rendering hot paths”). Keep messages concise and action-oriented.
- For PRs, include: a clear description of changes, any linked issues, and screenshots for UI updates.

## Configuration & Environment Notes
- Required versions: Node.js 18+ and Rust 1.70+ (MSRV is 1.70).
- Platform-specific prerequisites follow the Tauri docs: https://tauri.app/start/prerequisites/.
