# Business components (src/components/business/)

## Overview

App-specific compositions: panels, modals, and flows.

## Rules

Backend boundary rules live in `src/AGENTS.md`. This directory focuses on app-specific compositions.

## Known exceptions (historical)

- `ChatContainer/DirectorySelector.tsx`: calls remote directory listing directly.
- `FileBrowserPanel/index.tsx`: mixes local api + remote invoke.
- `TerminalPanel/index.tsx`: listens to terminal events directly.

If you touch these, try to shrink the surface (move calls into `src/api/` + `src/hooks/`).
