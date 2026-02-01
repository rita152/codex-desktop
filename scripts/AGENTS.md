# Scripts (scripts/)

## Overview

Repo automation and CI parity.

## quality-gate.mjs

Runs the same checks CI runs, and enforces additional structural limits.

Entry:

```bash
npm run quality:gate
```

What it enforces (defaults):

- `format`: `npm run format`
- `lint`: `npm run lint -- --max-warnings=0`
- `build`: `npm run build`
- `coverage`: `vitest --run --config vitest.unit.config.ts --coverage ...`
- `test`: `npm run test` (Vitest browser + Playwright)
- `audit`: `npm audit --audit-level=high`
- `size`: gzip limits against `dist/assets` (JS 250KB, CSS 50KB)
- `abstraction`: path/import depth limits; re-export-only and cycles checks

Config via env:

- `QUALITY_GATE_SKIP` (comma-separated): `format,lint,build,coverage,test,audit,size,abstraction`
- Coverage thresholds: `QUALITY_GATE_COVERAGE_{LINES,STATEMENTS,FUNCTIONS,BRANCHES}`
- Size thresholds: `QUALITY_GATE_{JS,CSS}_GZIP_LIMIT_KB`
- Structure: `QUALITY_GATE_MAX_{IMPORT_DEPTH,PATH_DEPTH,REEXPORT_ONLY_FILES}`
- Audit: `QUALITY_GATE_AUDIT_REGISTRY`

Common pitfall: skipping `build` but not `size` will fail because `dist/assets` is missing.
