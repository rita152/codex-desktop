# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-28
**Commit:** 77a37dc
**Branch:** main

Codex Desktop: a Tauri 2 desktop app (Rust backend) with a React 19 + TypeScript + Vite 7 frontend.

## STRUCTURE

```
./
├── src/                # React app (UI + business + hooks + api)
├── src-tauri/          # Tauri/Rust backend (commands + services)
├── scripts/            # quality gate + sidecar fetch
├── docs/               # design/usage docs ("current implementation")
├── codex-acp/          # git submodule (upstream ACP + npm wrapper)
├── .storybook/         # Storybook config
└── (removed) .kiro/    # local engineering rules/checklists (deleted)
```

## WHERE TO LOOK

| Task                         | Location                                                          |
| ---------------------------- | ----------------------------------------------------------------- |
| Frontend entry               | `src/main.tsx` → `src/App.tsx`                                    |
| Frontend architecture rules  | `src/AGENTS.md`                                                   |
| Tauri command wiring         | `src-tauri/src/lib.rs` (`generate_handler![...]`)                 |
| Frontend ↔ backend boundary  | `src/api/*` (invoke wrappers)                                     |
| Codex events (codex:\*)      | `src-tauri/src/codex/events.rs` + `src/hooks/useCodexEvents.ts`   |
| Remote servers & `remote://` | `src-tauri/src/remote/*` + `src/utils/remotePath.ts`              |
| Git integration              | `src-tauri/src/git/*` + `src/api/git.ts`                          |
| Settings                     | `src/hooks/useSettings.ts` + `src/types/settings.ts`              |
| CI/quality gate behavior     | `scripts/quality-gate.mjs` + `.github/workflows/quality-gate.yml` |
| ACP sidecar fetch            | `scripts/fetch-codex-acp.mjs` + `src-tauri/src/codex/binary.rs`   |

## COMMANDS

```bash
# install
npm install

# dev
npm run dev            # frontend only
npm run tauri dev      # desktop (Vite + Tauri)

# build
npm run build          # tsc + vite build
npm run tauri build    # triggers build:tauri (includes fetching codex-acp)

# tests
npm run test           # vitest browser (playwright)
npm run test:unit      # vitest unit

# local CI equivalent
npm run quality:gate

# backend (run inside src-tauri/)
cargo fmt --all -- --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

## GLOBAL CONVENTIONS (project-specific)

- TypeScript is **strict** + `noUnusedLocals/noUnusedParameters` (build fails on unused).
- CI treats **ESLint warnings as failures** (`--max-warnings=0`).
- No TS import alias configured (expect deep **relative imports**).
- Prettier ignores `src-tauri/`, `codex-acp/`, `docs/` (Rust side enforced by `cargo fmt`/`clippy`).

## ANTI-PATTERNS (THIS REPO)

- `src-tauri/src/main.rs`: **DO NOT REMOVE** the `windows_subsystem` cfg_attr.
- Avoid adding new direct `invoke()`/`listen()` usage inside components; prefer `src/api/` + `src/hooks/` (see `src/AGENTS.md`).
- Don’t reformat unrelated files.

## GOTCHAS

- Tauri sidecars: `bundle.externalBin: ["bin/codex-acp"]` expects a file named `src-tauri/bin/codex-acp-$TARGET_TRIPLE[.exe]`. Our fetch script writes `src-tauri/bin/codex-acp-<target>`; make sure `<target>` is the Rust target triple Tauri expects (see Tauri sidecar docs) or override via `CODEX_DESKTOP_ACP_*`.
- Remote server list comes from `~/.ssh/config` (current implementation); add/remove commands are intentionally not persistent.

## NESTED GUIDES (closest wins)

- `src/AGENTS.md`
- `src-tauri/AGENTS.md`
- `scripts/AGENTS.md`
- `docs/AGENTS.md`
- `.storybook/AGENTS.md`
