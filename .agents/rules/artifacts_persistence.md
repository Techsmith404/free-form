# 📦 Free Form: In-Repo Artifact Persistence Protocol

## Directive
All implementation plans, architecture design docs, task walkthroughs, and persistent artifacts generated during development MUST be saved directly (or mirrored) within the project repository under **`.agents/artifacts/`** (`/home/codaine/Projects/free-form/.agents/artifacts/`).

## Mandatory Agent Workflow
1. **In-Repo Artifact Directory:** When creating any plan, walkthrough, audit, or report artifact, always persist a copy in `.agents/artifacts/<artifact_name>.md`.
2. **Easy User Access:** Ensure clickable file links provided to the user point directly to the project's `.agents/artifacts/` directory so the user can easily find, review, and track all documents within the repository without navigating system data directories.
3. **Preservation:** Never delete past plan or walkthrough records in `.agents/artifacts/`; name or date them appropriately (e.g., `free_form_architecture_plan.md`, `walkthrough.md`).
