---
trigger: always_on
description: Mandatory Single Source of Truth protocol for Free Form
---

# 🏛️ Free Form: Single Source of Truth (SSoT) Protocol

## Directive
`SSoT.md` located at the root of this workspace (`/home/codaine/Projects/free-form/SSoT.md`) is the authoritative **Single Source of Truth** for Free Form.

## Mandatory Agent Workflow
1. **Session Inception:** At the start of every new conversation or when beginning a new task in this workspace, ALWAYS read `SSoT.md` to understand the full system architecture, database schema, multi-modal note engines, form template specifications, nested notebook structure, mobile PWA details, and hard-won lessons.
2. **Contextual Adherence:** Strictly uphold the architectural principles and compatibility constraints documented in `SSoT.md` (e.g., dual-mode JSON + Markdown storage, SQLite WAL pragma, safe schema migrations, native mobile bottom navigation, touch targets >= 44px).
3. **Mandatory Final Step:** Whenever you modify code, implement new features, change schemas, adjust layouts, or fix bugs, **YOU MUST UPDATE `SSoT.md` AND `README.md` AS THE FINAL STEP OF THE TASK** to ensure the single source of truth and user documentation remain 100% current and accurate.
