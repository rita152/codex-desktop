# UI feedback components

## Scope

Applies to `src/components/ui/feedback/**`.

## Overview

Reusable UI for streaming/approval/tool feedback. These components tend to be state-visualization heavy; keep logic minimal and data-driven.

## Patterns

- Support `variant: 'card' | 'embedded'` and keep layout differences in CSS.
- For collapsible content, use a `<button type="button">` trigger + `aria-expanded`.
- Prefer CSS-driven expand/collapse (0fr → 1fr) to avoid layout thrash.

## Styling

- Use shared CSS variables for padding and status pills (align across ToolCall/Approval/Thinking).
- No hard-coded colors.

## Storybook

- Title convention: `UI/Feedback/<Component>`.
- Keep a single `Default` story unless a documented exception exists.

## Where to look

- Tool call UI + collapse animation: `ToolCall/*`
- Approval cards + embedded display components: `Approval/*`
- Thinking/working phases + streaming affordances: `Thinking/*`
