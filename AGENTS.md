# 🏛️ Free Form: AI Agent Directives

## Single Source of Truth (`SSoT.md`)
The file **`SSoT.md`** at the root of this repository is the single source of truth for all architectural, database, multi-modal engine, template builder, mobile PWA, and container specifications for Free Form.

### AI Agent Rules:
1. **Always Read `SSoT.md` First:** When starting any new task or conversation in this repository, read `SSoT.md` to load full architectural context before proposing or making changes.
2. **Adhere to Documented Constraints:** Respect all SQLite WAL mode settings, safe schema migration protocols (`try { db.exec('ALTER TABLE ...'); } catch {}`), dual JSON/Markdown synchronization, and native mobile UX patterns.
3. **Always Update `SSoT.md` and `README.md` as the Final Step:** Whenever any feature is added, bug is resolved, schema is modified, or UI is overhauled, update `SSoT.md` and `README.md` before concluding your response.
4. **In-Repo Artifact Persistence:** Always save or mirror implementation plans, design documents, and walkthrough artifacts directly inside `.agents/artifacts/` (`.agents/artifacts/<artifact_name>.md`) so they reside within the project repo for easy user access.
5. **Verify Before Declaring Complete:** Always run `npm test --workspace=server` and `npm run build` to ensure 0 compiler or test regressions before completing your response.
