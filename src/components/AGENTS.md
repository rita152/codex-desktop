# Components (src/components/)

## Overview

Component tree is split into:

- `ui/`: reusable, presentational components.
- `business/`: app-specific compositions (panels, modals, flows).

## Directory template

Common layout (varies slightly per component):

```
Component/
├── index.tsx        # implementation (often the entrypoint)
├── types.ts         # props/types (optional)
├── Component.css    # styles
└── Component.stories.tsx
```

## Rules

- Tauri boundary rules (no new `invoke()` / `listen()` in components) live in `src/AGENTS.md`.
- Styling rules (CSS variables, no hard-coded colors) live in `src/AGENTS.md`.
