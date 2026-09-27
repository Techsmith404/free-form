# 🏛️ Free Form: Single Source of Truth (SSoT)

> **Document Version:** 1.9.0  
> **Last Updated:** September 27, 2026 — Android 16 Live Updates & Samsung One UI Now Bar Integration: `TimerForegroundService` (`specialUse`), `POST_PROMOTED_NOTIFICATIONS`, `setRequestPromotedOngoing` promotion, lock-screen visibility requirements, and Developer Options gateway documentation  
> **Target Audience:** Core Developers, Autonomous Coding Agents, System Administrators  
> **Location:** Root directory (`/SSoT.md`)  
> **Directive for AI Agents:** This file is the authoritative single source of truth for Free Form. You MUST read this document at the start of every session, consult it throughout implementation, and proactively update it whenever features, schemas, architectures, workarounds, or timers change.

---

## 📋 Table of Contents

1. [Project Overview & Philosophy](#1-project-overview--philosophy)
2. [System Architecture & Technology Stack](#2-system-architecture--technology-stack)
3. [Database Schema & Data Models](#3-database-schema--data-models)
4. [Multi-Modal Note Engines & Item Types](#4-multi-modal-note-engines--item-types)
5. [The "Free Form" Template System](#5-the-free-form-template-system)
6. [Universal Synced Timers & Reminders](#6-universal-synced-timers--reminders)
7. [Offline-First Local Storage, Outbox & Bi-Directional Sync](#7-offline-first-local-storage-outbox--bi-directional-sync)
8. [Notebook Hierarchy & Organization Architecture](#8-notebook-hierarchy--organization-architecture)
9. [Card & List Presentation Architecture](#9-card--list-presentation-architecture)
10. [Settings, Theming & Priority System](#10-settings-theming--priority-system)
11. [Native Mobile PWA & Android APK Architecture](#11-native-mobile-pwa--android-apk-architecture)
12. [REST API Catalog & Endpoint Specifications](#12-rest-api-catalog--endpoint-specifications)
13. [User Accounts, Auth & Packaging Roadmap](#13-user-accounts-auth--packaging-roadmap)
14. [Containerization, Self-Hosting & Local Testing](#14-containerization-self-hosting--local-testing)
15. [Critical Workarounds, Gotchas & Hard-Won Lessons](#15-critical-workarounds-gotchas--hard-won-lessons)
16. [AI Agent Maintenance Protocol](#16-ai-agent-maintenance-protocol)

---

## 1. Project Overview & Philosophy

**Free Form** is an open-source, self-hostable, multi-modal note-taking platform and structured form engine. It is designed to bridge the gap between two existing extremes:
1. **Unstructured freeform text apps** (Obsidian, Bear, Apple Notes) that lack native repeatability for structured logs, checklists, equipment checks, and day-to-day data entry.
2. **Heavy cloud relational databases** (Notion, Airtable) that suffer from mobile latency, vendor lock-in, proprietary data formats, and internet dependence.

### Core Tenets

* **Local-First & Air-Gapped Autonomy:** Runs 100% self-hosted via Docker or bare Node.js with zero mandatory internet connections. Data lives in an embedded SQLite database (`freeform.db`) alongside local file uploads.
* **Dual Representation (Form + Markdown):** Every structured form note maintains both machine-readable JSON metadata (for re-opening in form builders/runners) and clean, human-readable GitHub-flavored Markdown text.
* **Multi-Modal Expressiveness:** Notes are not restricted to plain text; they encompass rich WYSIWYG markdown, dynamic structured forms, interactive tally counters, rich web bookmarks, and photo scrapbook collages.
* **Universal Synced Timers & Reminders:** Set a timer or reminder on any screen and watch it stay synchronized in real time across desktop, mobile, and web. When it rings, it alerts every connected device until any one device stops it.
* **Hierarchy Without Clutter:** Full support for nested notebook trees, accompanied by a strict "Hide from All Items" feed exclusion protocol so high-frequency logbooks do not overwhelm the main workspace feed.
* **True Native Mobile Experience:** Progressive Web App (PWA) with a dedicated 5-tab fixed bottom navigation bar, quick-add mobile bottom sheet, hierarchical back navigation, touch targets >= 44px, and offline Workbox asset caching.

---

## 2. System Architecture & Technology Stack

```
free-form/
├── client/                     # Vite + React 18 PWA Frontend
│   ├── public/                 # Favicons, Web Manifest, PWA PNG icons (192, 512), clean SVG logo
│   ├── src/
│   │   ├── api/                # Typed fetch client (Items, Notebooks, Templates, Timers, Reminders, Dynamic Server URL)
│   │   ├── components/
│   │   │   ├── editor/         # TipTap WYSIWYG & Source Markdown Editor
│   │   │   ├── forms/          # Form Runner Modal & Template Builder Modal
│   │   │   ├── items/          # Cards: Note, FormEntry, Counter, Bookmark, Poster, ItemListItem
│   │   │   ├── layout/         # Sidebar (hierarchical tree), Navbar (filters, mobile back, timer pill)
│   │   │   ├── modals/         # New Notebook, Bookmark, Counter, Poster, Markdown Viewer, Timers & Reminders, AlarmAlert, SettingsModal
│   │   │   └── views/          # Templates View
│   │   ├── context/            # RealtimeContext (WebSocket state, auto-reconnect, cross-device sync)
│   │   ├── services/           # Web Audio API alarm synthesizer & Native Device Service (Haptics, Local Notifications)
│   │   ├── types/              # Frontend TypeScript Interfaces & Types
│   │   ├── App.tsx             # Main Application Shell & Navigation Controller
│   │   ├── index.css           # Tailwind base, touch action & custom scrollbars
│   │   └── main.tsx            # React root, Native App Init & Service Worker registration
│   └── vite.config.ts          # Vite configuration & VitePWA Workbox setup
├── server/                     # Fastify 5 + SQLite Backend
│   ├── src/
│   │   ├── db/                 # better-sqlite3 connection, WAL pragma, schema & migrations
│   │   ├── routes/             # REST routes: items, notebooks, templates, timers, reminders, settings, upload, export
│   │   ├── services/           # Form-to-Markdown generation, OpenGraph scraper & Realtime WebSocket ticker
│   │   ├── types/              # Backend TypeScript Interfaces & Types
│   │   ├── index.ts            # Fastify server bootstrap, WebSocket gateway & static file serving (with cache-busting)
│   │   └── index.test.ts       # Vitest unit test suite (Core, Timers, Reminders)
│   └── tsconfig.json
├── android/                    # Native Android Studio Project (Capacitor)
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml # Permissions (INTERNET, ALARMS, VIBRATE) & Cleartext LAN support
│   │   └── res/                # Native launcher mipmaps & splash drawables
│   └── gradlew                 # Gradle wrapper for Android APK compilation
├── capacitor.config.ts         # Capacitor Android configuration (appId: io.freeform.notes)
├── .github/workflows/          # GitHub Actions CI/CD workflows
│   └── build-apk.yml           # Automated Android debug APK build & release pipeline
├── data/                       # Persistent Host Volume (SQLite DB + Uploaded Assets)
│   ├── freeform.db             # Primary SQLite WAL database
│   └── uploads/                # User uploaded images and canvas signature SVGs/PNGs
├── scripts/
│   ├── build-apk.sh            # Automated local/CI Android APK build script
│   └── test-local.sh           # Automated Docker build, healthcheck & test runner
├── .agents/                    # Agent directives, persistent artifacts & rules
│   ├── artifacts/              # Mirrored implementation plans & walkthroughs
│   └── rules/                  # Active agent protocols (SSoT, Artifacts)
├── Dockerfile                  # Multi-stage production container build
├── docker-compose.yml          # Container orchestration with volume mounts
├── AGENTS.md                   # Agent guidelines & SSoT rules
├── README.md                   # User documentation
└── SSoT.md                     # This file (Single Source of Truth)
```

### Core Technologies

| Layer | Technology | Rationale |
|---|---|---|
| **Runtime** | Node.js 20+ (LTS) / Node 22 | Modern ECMAScript, native fetch, high performance. |
| **Backend Framework** | Fastify v5 | Extremely fast, low overhead, native TypeScript schema support. |
| **Realtime Gateway** | `@fastify/websocket` + `ws` | Instant bidirectional event broadcast for cross-device timer synchronization. |
| **Database** | SQLite via `better-sqlite3` | Zero-latency embedded database, synchronous execution in WAL mode. |
| **Frontend Framework** | React 18 + TypeScript | Componentized declarative UI with strict type safety. |
| **Audio Synthesizer** | Web Audio API (`AudioContext`) | Built-in zero-file procedural alarm chimes (zero 404s, works 100% offline). |
| **Bundler & Tooling** | Vite 6 | Sub-second HMR and optimized production Rollup bundling. |
| **Styling** | Tailwind CSS 3 | Utility-first styling with dark-mode aesthetic. |
| **Rich Text Editor** | TipTap (ProseMirror core) | Headless WYSIWYG editor with seamless Markdown conversion. |
| **Icons** | Lucide React | Lightweight, consistent SVG icon set. |
| **PWA & Offline** | `vite-plugin-pwa` + Workbox | Cache-first asset strategy, installable manifest, offline readiness. |
| **Containerization** | Docker + Docker Compose | One-click self-hosting with isolated persistent data volume. |


---

## 3. Database Schema & Data Models

Database initialization and migrations reside in [`server/src/db/index.ts`](file:///home/codaine/Projects/free-form/server/src/db/index.ts).

### Pragmas
* `PRAGMA journal_mode = WAL;` (Write-Ahead Logging for high concurrency and write speed)
* `PRAGMA foreign_keys = ON;` (Referential integrity enforcement)

### Schema Definitions

```sql
CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#22c55e',
  icon TEXT DEFAULT 'folder',
  parent_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
  default_template_id TEXT,
  view_mode TEXT DEFAULT 'grid',
  sort_order INTEGER DEFAULT 0,
  hide_from_all INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'file-text',
  color TEXT DEFAULT '#3b82f6',
  default_notebook_id TEXT,
  fields_schema TEXT NOT NULL, -- JSON array of FormFieldDefinition
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,          -- 'note' | 'counter' | 'bookmark' | 'poster' | 'form_entry'
  content TEXT DEFAULT '',     -- Markdown representation
  metadata TEXT DEFAULT '{}',  -- JSON typed metadata
  priority TEXT DEFAULT '',    -- ID of configured NotePriority ('low', 'medium', 'high', 'urgent', or custom)
  is_favorite INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  is_archived INTEGER DEFAULT 0,
  hide_from_all INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS counter_history (
  id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
  delta REAL NOT NULL,
  new_value REAL NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#6b7280'
);

CREATE TABLE IF NOT EXISTS item_tags (
  item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
  tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE IF NOT EXISTS timers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  remaining_seconds INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'idle' | 'running' | 'paused' | 'ringing' | 'dismissed'
  target_end_time TEXT, -- ISO string when running
  started_at TEXT,
  paused_at TEXT,
  completed_at TEXT,
  notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  due_date TEXT NOT NULL, -- ISO timestamp
  status TEXT NOT NULL, -- 'pending' | 'triggered' | 'completed' | 'dismissed'
  priority TEXT DEFAULT 'normal', -- 'low' | 'normal' | 'high'
  notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_notebook ON items(notebook_id);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_favorite ON items(is_favorite);
CREATE INDEX IF NOT EXISTS idx_items_hidden ON items(hide_from_all);
CREATE INDEX IF NOT EXISTS idx_items_updated ON items(updated_at);
CREATE INDEX IF NOT EXISTS idx_counter_history_item ON counter_history(item_id);
CREATE INDEX IF NOT EXISTS idx_timers_status ON timers(status);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date);
```

### Safe Migration Protocol
Whenever new columns are introduced, they MUST be added with fallback `try { db.exec('ALTER TABLE ...'); } catch {}` statements in `initDatabase()` so existing SQLite database volumes seamlessly upgrade without data loss.

---

## 4. Multi-Modal Note Engines & Item Types

Free Form supports 5 discrete note formats under a unified `items` table:

| Type | Purpose | Key Metadata Properties |
|---|---|---|
| `note` | Unstructured or rich markdown notes. | WYSIWYG formatted content, checklists, code blocks, raw markdown toggle. |
| `form_entry` | Structured form entries generated from custom form templates. | `template_id`, `template_name`, `values: Record<string, any>`. Automatically generates formatted GitHub-Flavored Markdown. |
| `counter` | Interactive numeric tallies and steppers. | `count`, `step`, `min`, `max`, `unit`, `resetValue`. Every change writes an audit record to `counter_history`. |
| `bookmark` | Rich webpage links with automated metadata scraping. | `url`, `ogTitle`, `ogDescription`, `ogImage`, `favicon`, `siteName`. |
| `poster` | Scrapbook visual collages and photo mood boards. | `images: Array<{ id, url, name, caption, size }>`. Supports multi-image uploads and lightbox zoom. |

---

## 5. The "Free Form" Template System

The signature feature of Free Form is custom reusable templates that allow users to generate structured, repeatable notes with zero coding required.

### Supported Field Blocks (`FormFieldType`)
* `text`: Single-line text input.
* `textarea`: Multi-line text area.
* `number`: Numeric input with optional `min`, `max`, `step`, and `unit` label.
* `date`: Calendar date selector. **Automatically defaults to current local date (`YYYY-MM-DD`).**
* `time`: Native time selector (`<input type="time" />`). **Automatically defaults to current local time (`HH:MM`).**
* `select`: Single-select dropdown from custom user-defined options.
* `checkbox`: Binary boolean checkbox with clean badge pills.
* `rating`: 1-to-5 interactive star rating selector.
* `table`: Embedded mini spreadsheet with custom named columns and **configurable default row count (`defaultRows`)**.
* `signature`: HTML5 canvas signature pad for stylus, finger, or mouse signing. Automatically exports to SVG/data URI.
* `header`: Section divider with title and description for structuring long forms.

### Dual-Representation Architecture
When a form is submitted via [`FormRunnerModal.tsx`](file:///home/codaine/Projects/free-form/client/src/components/forms/FormRunnerModal.tsx):
1. Raw form values are stored in `item.metadata.values`.
2. [`server/src/services/markdown.ts`](file:///home/codaine/Projects/free-form/server/src/services/markdown.ts) converts the form into clean, human-readable Markdown stored in `item.content`.
3. Users can view the note as rendered Markdown, edit it in the form runner, or export it to `.md` files.

### Form Entry Processed / Seen Status Tracking
For high-frequency form workflows (e.g. daily inspections or mobile intake logs later entered into desktop databases):
* **Template Configuration:** Each template can enable/disable processed tracking via `enable_processed_tracking` (default: true).
* **Metadata Persistence:** Entries store `is_processed: boolean` and `processed_at: string | null` in `item.metadata`.
* **1-Tap Workflow:** Users can toggle processed status directly from card headers (`FormEntryCard`), list rows (`ItemListItem`), or within the Form Runner modal.
* **"Disabled" / Grayed-Out Visual Footprint:** Processed entries render with `opacity-65 grayscale-[35%] bg-zinc-950/40 border-dashed` and a green `✓ Processed` badge, clearly distinguishing them from pending entries without actually disabling interactions.
* **Smart Collapse:** In grid view, processed entries default to a compact, single-line footprint (`expanded = false`), keeping pending forms tall and prominent.

---

## 7. Offline-First Local Storage, Outbox & Bi-Directional Sync

Free Form operates with an **airtight, offline-first local architecture** that allows both the native Android APK and web PWA to function completely disconnected from the backend server without losing state across app terminations or device restarts.

### 1. Persistent Local Storage Engine (`offlineDb.ts`)
* Uses browser/WebView native **IndexedDB** (`freeform_local_db`) with dedicated stores: `items`, `notebooks`, `templates`, `reminders`, `settings`, `conflicts`, `outbox`, and `meta`.
* **Zero-Latency Boot:** On application launch, notes and forms load instantly from IndexedDB before attempting network requests.
* **Persistent Outbox Mutation Queue:** Offline mutations (`create_item`, `update_item`, `delete_item`, `counter_adjust`, `create_notebook`, etc.) are serialized into the `outbox` store with client timestamps and base timestamps.

### 2. Bi-Directional Synchronization Protocol (`POST /api/sync`)
* **Triggering:** Sync triggers automatically on network reconnect (`window.addEventListener('online')`), WebSocket reconnect, periodic background interval (30s), or manual trigger in Settings.
* **Push Phase:** Pending outbox mutations are sent to `POST /api/sync` and processed in a SQLite transaction.
* **Pull Phase:** Server returns all items, notebooks, templates, reminders, and open conflicts updated since `last_sync_timestamp`.
* **Local Ingestion:** Processed mutations are pruned from the local outbox, server changes are written to IndexedDB, and a `freeform:sync-complete` event notifies React components to update state.

### 3. Git-Inspired 3-Way Conflict Resolution
When concurrent edits occur on multiple devices while offline:
* **Automatic Active Promotion:** The version with the most recent timestamp automatically becomes the active note in the workspace feed.
* **Zero Data Loss:** The conflicting version is stored in the database `conflicts` table and preserved on all devices.
* **Attention Banners & Sidebar Badge:** An attention banner appears in the navbar and sidebar with an amber count badge.
* **Visual Diff & Merge Modal (`ConflictResolverModal.tsx`):**
  * Side-by-side comparison of Active vs Conflicting edits.
  * 4 One-Click Actions:
    1. **Keep Active:** Discards the conflict copy.
    2. **Use Conflict Edit:** Restores the conflict version to replace the active note.
    3. **Keep Both Notes:** Preserves both by creating a separate `[Title (Conflict Copy)]` note.
    4. **Custom Merge:** Opens an interactive merged markdown editor to pick or combine sections.

### 4. Mathematical Counter Delta Merging
Counters do not overwrite each other during offline synchronization; instead, `counter_adjust` mutations send incremental deltas (`delta: +2`, `delta: +3`) which are mathematically added to the server count and recorded in `counter_history`.

---

## 8. Notebook Hierarchy & Organization Architecture

### 1. Hierarchical Nesting
* Notebooks can have an optional `parent_id` referencing another notebook.
* **Sidebar Tree:** [`Sidebar.tsx`](file:///home/codaine/Projects/free-form/client/src/components/layout/Sidebar.tsx) renders notebooks recursively with collapsible chevron toggles, depth indentation, item counts, and a direct `+` button to add a sub-notebook.
* **In-Notebook Breadcrumbs:** When viewing a notebook, the header displays clickable breadcrumbs: `All Items > Parent Notebook > Current Notebook`.
* **Sub-Notebooks Grid:** If an active notebook has child notebooks, they are rendered as an interactive grid of sub-notebook cards at the top of the note feed.
* **Cycle Prevention:** [`NewNotebookModal.tsx`](file:///home/codaine/Projects/free-form/client/src/components/modals/NewNotebookModal.tsx) implements `isDescendant()` checking to prevent circular parent references.

### 2. "Hide from All Items" Protocol
To prevent high-frequency operational notes (like daily inspections or fuel logs) from drowning out personal notes in the main feed:
* **Notebooks:** Can be toggled with `hide_from_all = 1`. All notes belonging to this notebook are excluded from the root "All Items" feed.
* **Individual Items:** Any individual note, counter, bookmark, or form note can be toggled with `hide_from_all = 1`.
* **In-Notebook Visibility:** Items belonging to a hidden notebook remain 100% visible and accessible when navigating inside that specific notebook (`activeNotebookId === notebook.id`).
* **Feed Reveal Toggle:** When browsing the global All Items feed, if hidden items exist, an interactive banner displays: `[👁 N hidden items excluded from feed (click to reveal)]`, allowing instant 1-click inspection without changing settings.

---

## 8. Card & List Presentation Architecture

Free Form supports two distinct, responsive browsing layouts switchable via the Navbar:

### 1. Grid Card View (`viewMode === 'grid'`)
* **Tactile Styling:** `border border-zinc-800 bg-zinc-900/95 shadow-md hover:border-zinc-700/80 active:scale-[0.98]`.
* **Color-Coded Priority Accents:** When an item has a configured priority (`items.priority`), note cards render a 3px colored left border accent matching the priority's hex color, plus an elegant badge pill (`bg-opacity-15`, border, text).
* **Rich Form Note Previews:** [`FormEntryCard.tsx`](file:///home/codaine/Projects/free-form/client/src/components/items/FormEntryCard.tsx) directly renders filled field values: golden star ratings (`★`), status badge pills, mini-tables, key-value data with units, and signature thumbnails.
* **Rich Note Card Previews:** [`NoteCard.tsx`](file:///home/codaine/Projects/free-form/client/src/components/items/NoteCard.tsx) parses and renders authentic GitHub-Flavored Markdown directly on the card: compact headings, visible disc bullets (`•`), numbered lists, bold typography, inline code, and checkboxes via `.note-markdown` styles.
* **Accordion Controls:**
  * Each form card and note card features an individual **"Show Details / Full Note" / "Collapse"** chevron toggle.
  * When collapsed, note cards clamp to a maximum height (`max-h-40 sm:max-h-48`) with a subtle bottom gradient fade; when expanded, the full formatted markdown note is rendered.
  * The top Navbar features a global **Expand All / Collapse All** (`ChevronsUpDown`) toggle that orchestrates both note cards and form cards simultaneously.
  * **Template-Bound Notebooks Expand by Default:** Opening a notebook bound to a form template automatically defaults all cards to expanded.

### 2. Compact List View (`viewMode === 'list'`, `ItemListItem.tsx`)
On mobile devices and narrow viewports, the grid view previously showed little visual distinction from list mode. Free Form introduces a true high-density row component:
* **Compact Row Design (`~60px`):** Single-row layout on desktop and clean 2-line layout on mobile.
* **Vertical Priority Indicator:** A 4px vertical colored indicator bar on the left edge denoting the note's assigned priority.
* **Type Badge & Icon:** Color-coded type indicator (Form, Counter, Bookmark, Poster, Note).
* **Inline Counter Actions:** Interactive tally counters can be incremented (`+`) or decremented (`-`) directly from the list row without opening any dialog.
* **Metadata Snippet:** Form entry field count, bookmark domain / URL, poster image count, or note text snippet shown at a glance.
* **Quick Hover Actions:** Pin, Favorite, and Delete buttons cleanly grouped with touch-friendly targets.

---

## 9. Settings, Theming & Priority System

### 1. Dedicated Settings Modal (`SettingsModal.tsx`)
Accessible via the Navbar gear button or the Sidebar footer:
* **Appearance Tab:** Switch between `Dark`, `Light`, and `Follow System` modes.
* **Priorities Tab:** Full CRUD management for custom note priorities. Add, edit label, pick from preset palette or custom hex code, preview badge pill in real time, or restore defaults.
* **System & Connection Tab:** Live WebSocket connectivity indicator, latency ping, reconnect trigger, export workspace backup ZIP, and client/server version details.

### 2. Universal Light / Dark / System Palette Architecture
Rather than maintaining hundreds of duplicate `dark:` classes, Free Form maps the complete Tailwind `zinc` palette (shades 50–950) to dynamic CSS variables:
* In `client/tailwind.config.js`:
  ```js
  zinc: {
    50: 'rgb(var(--color-zinc-50) / <alpha-value>)',
    ...
    950: 'rgb(var(--color-zinc-950) / <alpha-value>)'
  }
  ```
* In `client/src/index.css`:
  * `:root`: Light mode values (`zinc-950` = `#f8fafc` background, `zinc-900` = `#ffffff` cards/modals, `zinc-100` = `#18181b` text).
  * `html.dark`: Dark mode values (`zinc-950` = `#09090b` background, `zinc-900` = `#18181b` cards/modals, `zinc-100` = `#f4f4f5` text).
* When set to `system`, a native `window.matchMedia('(prefers-color-scheme: dark)')` listener automatically toggles `html.dark` to match OS dark/light mode instantly.

### 3. Prominent Server Status & Auto-Reconnect
* **Navbar Indicator:** Green status pill (`Connected`) with pulsing dot when active; red pulsing pill (`Offline (Retry)`) when disconnected.
* **Top Offline Banner:** Prominent amber/red banner below Navbar showing reconnect attempt countdown and a manual "Retry Now" action.
* **Auto-Reconnect:** Exponential backoff reconnects automatically on disconnect; immediately attempts reconnection when the browser fires the `window.online` event.

---

## 10. Native Mobile PWA Architecture

Free Form delivers an authentic mobile app experience on iOS, Android, and foldable devices:

### 1. Fixed Bottom Navigation Bar (`lg:hidden`)
A fixed native bottom tab bar provides immediate 1-tap navigation with proper active indicator pill:
1. **All Notes (`FileText`):** Jumps to the root feed. Active: green top-line indicator.
2. **Notebooks (`Folder`):** Opens the mobile notebook drawer. Active: green top-line indicator.
3. **Elevated Center FAB (`+`):** Prominent 56×56px circular button (up from 48px), ring-4 border with brand shadow.
4. **Templates (`ClipboardList`):** Opens the form templates catalog. Active: green top-line indicator.
5. **Favorites (`Star`):** Filters to favorited items. Active: amber top-line indicator.
* Fully respects mobile safe area: `pb-[max(env(safe-area-inset-bottom),0.75rem)]`.
* Each tab button: `min-w-[52px]`, `py-2 px-4`, sufficient for comfortable thumb navigation.

### 2. Mobile Quick-Add Action Sheet (Bottom Sheet)
Tapping the center `+` button opens a native **bottom-sheet** (slides from bottom of screen, no floating card). Features:
* **Sheet handle** drag indicator at top.
* Each action row is `min-h-[64px]` with 44×44px icon badge — very thumb-friendly.
* Proper safe-area bottom padding: `pb-[max(env(safe-area-inset-bottom),1rem)]`.

### 3. Full-Screen Modals on Mobile
All modals (NoteEditorModal, FormRunnerModal, NewBookmarkModal, NewCounterModal, NewPosterModal, NewNotebookModal, MarkdownViewerModal, TemplateBuilderModal) now use a **bottom-sheet** pattern on mobile:
* Container: `flex items-end sm:items-center` — sticks to bottom of screen on mobile.
* Modal inner: `h-[97dvh]` on mobile, `max-h-[90vh]` on desktop. Uses `dvh` units for correct height on mobile browsers.
* Animation: `slide-in-from-bottom-4` on mobile, `zoom-in-95` on desktop.
* Border: top-only (`border-t`) on mobile, full (`border`) on desktop. Rounded top corners only on mobile.

### 4. Foldable Phone Support (Z Fold 6 Inner Screen)
The inner screen of foldables like the Z Fold 6 is ~360px wide — between `sm` (640px) and the default:
* Cards: single column at all widths below `md` (768px).
* Navbar: compact (3px padding, 2.5px gaps) — shows full controls without overflow.
* Type filter chips: `h-10` on mobile (from `h-9`), ensuring comfortable tap on narrow screens.
* FAB: 56×56px — easy to hit even on 360px-wide inner screen.
* Modals: `h-[97dvh]` fills the inner screen height precisely.

### 5. Touch & Gesture Polish
* All buttons: minimum 44×44px touch targets via explicit `h-10 w-10 flex items-center justify-center`.
* `touch-manipulation` class on all interactive elements eliminates 300ms tap delay.
* `-webkit-tap-highlight-color: transparent` eliminates mobile tap flashing.
* `overscroll-behavior: contain` prevents iOS bounce causing layout jumps.
* `-webkit-overflow-scrolling: touch` enables momentum scrolling on iOS.
* `font-size: max(16px, 1em)` on inputs prevents iOS auto-zoom on focus.
* Active states: `active:scale-[0.98]` on cards, `active:scale-95` on buttons for tactile feedback.
* **Refined Haptic Feedback Hierarchy (`services/native.ts`):** 
  * `hapticTap()`: Utilizes `Haptics.selectionChanged()` (with 6ms web vibration fallback) for an ultra-light, crisp mechanical tick on general UI interactions (tabs, FAB, buttons, filters, toggles), preventing strong buzzy vibrations on everyday taps.
  * `hapticMedium()`: Utilizes `Haptics.impact({ style: ImpactStyle.Light })` (15ms fallback) for counter tally clicks and step increments.
  * `hapticHeavy()`: Utilizes `Haptics.impact({ style: ImpactStyle.Medium })` (30ms fallback) for destructive deletions and archive actions.
  * `hapticSuccess()` / `hapticWarning()`: Multi-pulse patterns for form runner completion and ringing timer/reminder alarms.
* **First-Party Native Android Timer Engine (`NativeTimerPlugin.java` & `NativeAlarmReceiver.java`):**
  * **Persistent Live Chronometer (`timer_countdown_channel`):** Uses Android's native `NotificationCompat.Builder.setUsesChronometer(true)`, `setChronometerCountDown(true)`, `setOngoing(true)`, and `setWhen(targetEndTimeMillis)` on `IMPORTANCE_LOW` with public lock-screen visibility (`VISIBILITY_PUBLIC`) and category `CATEGORY_STOPWATCH`.
  * **Sticky & Protected:** Immune to "Clear all notifications" actions in the Android shade, keeping the live ticking countdown pinned until stopped or expired.
  * **Interactive Notification Actions:** Equips the live notification and lock-screen widget with native action buttons (`[⏸ Pause]` and `[⏹ Stop]`) that dispatch directly through `NativeAlarmReceiver` back to the app's WebSocket gateway.
  * **OS-Level High-Priority Alarm (`AlarmManager.RTC_WAKEUP`):** When the timer reaches 0, `AlarmManager` triggers `NativeAlarmReceiver`, waking the screen and playing the device's native system alarm ringtone (`RingtoneManager.TYPE_ALARM`) on the alarm audio stream with looping and vibration.
  * **Full-Screen Heads-Up Alarm Alert:** Posts a high-priority heads-up modal (`CATEGORY_ALARM`, `PRIORITY_MAX`, `IMPORTANCE_HIGH`) with a 1-tap `[⏹ Stop Alarm]` action that displays directly over the lock screen or any active app.
  * **True Bi-Directional Cross-Device WebSocket Synchronization:** Stopping or pausing the timer on Android sends a WebSocket event silencing all desktop/laptop screens immediately; stopping the alarm on desktop or web instantly calls `NativeTimer.stopAlarm()` on Android, silencing the phone ringtone and clearing the notification.
  * **Clean OEM Separation:** Fully eliminates one-way Samsung Clock collisions (`AlarmClock.ACTION_SET_TIMER`), ensuring a single unified timer experience.

### 6. Mobile Navbar & Safe Area Insets
* **Status Bar Non-Overlap:** Explicitly configures `StatusBar.setOverlaysWebView({ overlay: false })` in Capacitor alongside CSS environment safe areas: `pt-[max(env(safe-area-inset-top),0.625rem)]` on `<Navbar>` and `pt-[max(env(safe-area-inset-top),1rem)]` on `<Sidebar>` brand header. This prevents the Android/iOS status bar (clock, battery, Wi-Fi) from overlapping buttons or navigation controls.
* **Live Header Countdown Ticker:** The top navigation bar runs a 1000ms interval ticker against `runningTimer` so the top countdown pill updates live second-by-second without needing to open the timers modal.
* **Back button:** `h-11` with pill shape and `touch-manipulation` — much easier to tap than the previous compact button.
* **Search bar on mobile:** `h-12` input, autofocuses on open, X to clear closes the bar.
* **Type filter chips:** `h-10 sm:h-9` — slightly taller on mobile for easier tap.
* **Search toggle:** Shows `X` icon when open (to close), `Search` icon when closed.

### 7. Native In-App Confirmation Dialogs (`ConfirmModal.tsx`)
* **Zero Browser Popups:** All `window.confirm()` calls are replaced with custom native modals.
* **Mobile-First Bottom Sheet:** Slides gracefully from bottom of viewport on mobile devices (`rounded-t-2xl sm:rounded-2xl`) with thumb-friendly full-width actions (`min-h-[44px]`).
* **Desktop Centered Modal:** Smooth zoom-in (`sm:zoom-in-95`) with dark backdrop blur.
* **Contextual Semantics:** Colored icon badges (`Trash2` for destructive red actions, `RotateCcw`/`AlertTriangle` for amber warning actions, `Info` for neutral actions).
* **Keyboard & Accessibility:** Full `Escape` key dismissal, backdrop click-to-cancel, and async loading spinners (`Loader2`) preventing double-submissions.

### 8. Brand Identity & Production Icon Suite
* **Design Concept:** Stylized "F" ribbon lettermark flowing between sharp architectural geometry and fluid cursive ribbons. Features cyber teal/mint gradients (`#48BEB6` -> `#55DBC7`) on the upper arm, electric blue gradients (`#306ECE` -> `#3EAED7`) on the outer loop, and deep 3D underside shadows (`#0E2D40`), set against a dark indigo-charcoal rounded squircle with bevel strokes.
* **Mathematical Vector Curves:** Authored with smooth cubic Bézier curves (`C`), eliminating all raster stair-steps, bumps, and auto-tracing artifacts.
* **Full Production Asset Matrix:**
  * `client/public/freeform_icon.svg` & `logo.svg`: Pure vector source masters.
  * `client/public/pwa-512x512.png`: 512×512 HD Android splash & PWA icon.
  * `client/public/pwa-192x192.png`: 192×192 standard mobile launcher icon.
  * `client/public/apple-touch-icon.png`: 180×180 iOS home screen icon.
  * `client/public/favicon.ico`: Multi-layer Windows/browser icon (16×16, 32×32, 48×48).

### 9. Airtight Cache-Busting Architecture
To guarantee that mobile devices, desktop browsers, and PWAs never use stale HTML, outdated icons, or old service worker code:
* **Server-Side Headers (`server/src/index.ts`):** Fastify static asset middleware explicitly sends `Cache-Control: no-cache, no-store, must-revalidate` along with `Pragma: no-cache` and `Expires: 0` for `index.html`, `sw.js`, `registerSW.js`, and `manifest.webmanifest`.
* **Immutable Content-Hashed Bundles:** Production JS and CSS under `/assets/` are fingerprinted by Vite with content hashes and served with `Cache-Control: public, max-age=31536000, immutable`.
* **HTML Version Query Strings:** Public icon tags in `client/index.html` append cache-busting version tags (`href="/logo.svg?v=2"`, `href="/favicon.ico?v=2"`, `href="/apple-touch-icon.png?v=2"`).
* **Workbox Precaching:** `vite-plugin-pwa` precaches all icons and bundles with cryptographic hash revisions, prompting instant background updates.

---

## 11. REST API Catalog & Endpoint Specifications

All endpoints are hosted under `/api/*` on Fastify:

### Settings & Priorities (`/api/settings`)
* `GET /api/settings`: Returns user app settings (`theme`: `'light' | 'dark' | 'system'`, `priorities`: `NotePriority[]`).
* `PUT /api/settings`: Updates theme mode or priority definitions.

### Notebooks (`/api/notebooks`)
* `GET /api/notebooks`: Returns all notebooks with `item_count` and `default_template_name`.
* `GET /api/notebooks/:id`: Returns single notebook details.
* `POST /api/notebooks`: Creates notebook (`name`, `description`, `color`, `icon`, `parent_id`, `default_template_id`, `hide_from_all`).
* `PUT /api/notebooks/:id`: Updates notebook fields.
* `DELETE /api/notebooks/:id`: Deletes notebook (unlinks associated items).

### Items (`/api/items`)
* `GET /api/items`: Lists items with query filters:
  * `notebook_id`: Specific notebook ID or `'uncategorized'`.
  * `type`: Filter by `ItemType`.
  * `is_favorite`: `'1'` for favorited items.
  * `is_archived`: `'1'` for trash/archived items (default `'0'`).
  * `include_hidden`: When `'1'`, includes items flagged `hide_from_all = 1` in the global feed.
  * `search`: Searches titles and markdown content.
  * `tag`: Filters by tag name.
* `GET /api/items/:id`: Returns single item with metadata and tags.
* `POST /api/items`: Creates an item (`priority?` included). If `type === 'form_entry'`, auto-generates markdown.
* `PUT /api/items/:id`: Updates an item (`priority?` included). If form values change, updates markdown.
* `DELETE /api/items/:id`: Soft deletes (`is_archived = 1`) or permanent delete (`?permanent=1`).

### Counter Actions (`/api/items/:id/counter`)
* `POST /api/items/:id/counter`: Adjusts counter (`delta`, `reset`, `setValue`, `note`). Automatically records to `counter_history`.
* `GET /api/items/:id/counter-history`: Retrieves chronological audit trail for a counter.

### Templates (`/api/templates`)
* `GET /api/templates`: Lists all form templates with usage counts.
* `POST /api/templates`: Creates a form template with `fields_schema`.
* `PUT /api/templates/:id`: Updates a form template.
* `DELETE /api/templates/:id`: Deletes a form template.

### Universal Synced Timers (`/api/timers`)
* `GET /api/timers`: Returns all active, paused, and recent timers sorted by urgency.
* `POST /api/timers`: Creates a timer (`title`, `duration_seconds`, `notebook_id?`, `auto_start?`).
* `POST /api/timers/:id/start`: Starts or resumes a timer; sets `target_end_time` and broadcasts to all clients.
* `POST /api/timers/:id/pause`: Freezes remaining seconds; broadcasts to all clients.
* `POST /api/timers/:id/reset`: Resets timer to initial duration in `idle` state.
* `POST /api/timers/:id/dismiss`: Silences a ringing timer; broadcasts dismissal to immediately stop audio on all devices.
* `DELETE /api/timers/:id`: Permanently deletes a timer.

### Scheduled Reminders (`/api/reminders`)
* `GET /api/reminders`: Returns scheduled reminders sorted by due date and status.
* `POST /api/reminders`: Schedules a reminder (`title`, `notes?`, `due_date`, `priority?`, `notebook_id?`).
* `PATCH /api/reminders/:id`: Updates reminder details.
* `POST /api/reminders/:id/complete`: Marks reminder completed.
* `POST /api/reminders/:id/dismiss`: Dismisses active reminder alert.
* `POST /api/reminders/:id/snooze`: Snoozes reminder by `N` minutes (`{ minutes: 5 }`).
* `DELETE /api/reminders/:id`: Deletes a reminder.

### Realtime WebSocket Gateway (`/api/ws`)
* `GET /api/ws` (`{ websocket: true }`): Real-time bi-directional connection.
  * **On Connect**: Server sends `{ type: 'SYNC_STATE', payload: { timers, reminders } }`.
  * **Server Broadcasts**: `TIMER_UPDATED`, `TIMER_RING`, `TIMER_DISMISSED`, `TIMER_DELETED`, `REMINDER_TRIGGER`, `REMINDER_DISMISSED`, `REMINDER_UPDATED`, `REMINDER_DELETED`.
  * **Client Inbound**: Sends instant actions (`DISMISS_TIMER`, `START_TIMER`, `PAUSE_TIMER`, `RESET_TIMER`, `DISMISS_REMINDER`, `COMPLETE_REMINDER`, `PING`).

### Utilities
* `POST /api/bookmarks/scrape`: Crawls a URL to extract OpenGraph metadata (`og:title`, `og:description`, `og:image`, `favicon`).
* `POST /api/upload`: Multipart file upload for images and signatures; saved to `./data/uploads/`.
* `GET /api/export`: Generates and streams a full workspace backup ZIP containing markdown files and `free-form-backup.json`.
* `GET /api/health`: Health check returning `{ status: 'ok', time: '...' }`.

---

## 12. User Accounts, Auth & Packaging Roadmap

Detailed architectural blueprints and migration steps are maintained in [`.agents/artifacts/user-accounts-auth-and-packaging-roadmap.md`](file:///home/codaine/Projects/free-form/.agents/artifacts/user-accounts-auth-and-packaging-roadmap.md):
* **Multi-Tenancy & User Isolation:** Zero-friction default (`AUTH_ENABLED=false`) for single-user local-first operation; optional `AUTH_ENABLED=true` requiring user accounts. Data isolation via `user_id` on all tables.
* **Authentication Engine:** Argon2id password hashing, opaque signed HTTP-Only session cookies with SQLite session store (`user_sessions`), and biometric WebAuthn / Passkeys.
* **Android APK Architecture (Capacitor):**
  * **Configuration:** [`capacitor.config.ts`](file:///home/codaine/Projects/free-form/capacitor.config.ts) (`appId: 'io.freeform.notes'`, `cleartext: true`, `androidScheme: 'http'`).
  * **Native Project:** Complete Android Studio project under [`android/`](file:///home/codaine/Projects/free-form/android/) with adaptive icons (`mipmap-*`) and splash drawables.
  * **Dynamic Server Switcher:** Stored via `@capacitor/preferences` with full test and reconnect capabilities directly inside [`SettingsModal.tsx`](file:///home/codaine/Projects/free-form/client/src/components/modals/SettingsModal.tsx).
  * **Native Background Timer Alarms:** Integrated via [`client/src/services/native.ts`](file:///home/codaine/Projects/free-form/client/src/services/native.ts) and `@capacitor/local-notifications`. Features dedicated `timer_alarms` Android notification channel (`IMPORTANCE_HIGH = 5`, vibration, public lock-screen visibility, custom sound, `allowWhileIdle: true`) to ring OS-level alarms even when the app is minimized or the screen is locked.
  * **Persistent Keystore & In-Place Updates:** Configured with a dedicated, permanent release keystore (`android/app/freeform.keystore`, alias `freeform`) so all local `./scripts/build-apk.sh` builds and GitHub Actions CI/CD releases share the exact same SHA-256 certificate signature. In-place `.apk` updates install seamlessly without needing to uninstall previous builds.
  * **Automated CI/CD & Build Scripts:** [`.github/workflows/build-apk.yml`](file:///home/codaine/Projects/free-form/.github/workflows/build-apk.yml) compiles and attaches `free-form-vX.X.X.apk` (and `free-form.apk`) to workflow artifacts and tagged GitHub releases; [`scripts/build-apk.sh`](file:///home/codaine/Projects/free-form/scripts/build-apk.sh) provides 1-command local building.
* **Linux Desktop Packaging (Tauri 2):** Lightweight Rust-based shell (~12MB AppImage, ~40MB RAM) producing `.AppImage`, `.deb`, and `.rpm` packages with native Plasma 6 / GNOME system tray integration and countdown timers.

---

## 13. Containerization, Self-Hosting & Local Testing

### Multi-Stage Dockerfile
* **Stage 1 (`builder`):** Compiles client (Vite + TypeScript) and server (TypeScript).
* **Stage 2 (`runner`):** Minimal `node:20-alpine` production image. Runs under unprivileged `node` user.
* **Volume Mount:** Mounts `./data:/app/data` for persistent storage of `freeform.db` and `./uploads`.
* **Port:** Exposes port `3000`.

### Local Test Script (`scripts/test-local.sh`)
Modeled after YardStik, this script provides automated zero-downtime container testing:
1. Validates Docker permissions (uses `sudo` only if required).
2. Verifies local persistent data directories (`./data/uploads`).
3. Shuts down any conflicting containers (`docker compose down`).
4. Rebuilds and starts the container in detached mode (`docker compose up -d --build`).
5. Polls the health check (`http://127.0.0.1:3000/api/health`) up to 45 seconds.
6. Displays container logs automatically on failure.

---

## 14. Critical Workarounds, Gotchas & Hard-Won Lessons

### 1. Capacitor Root `package.json` Plugin Discovery in NPM Workspaces
* **Issue:** In an npm workspaces repo (`client`, `server`), running `npx cap sync android` only discovers native plugins defined in the root `package.json`. If `@capacitor/haptics`, `@capacitor/local-notifications`, etc. are only listed in `client/package.json`, Capacitor CLI silently discovers 0 plugins and omits their Java bindings from `capacitor.settings.gradle` and `build.gradle`.
* **Resolution:** Always install `@capacitor/*` plugins at the workspace root (`npm install @capacitor/haptics @capacitor/local-notifications @capacitor/status-bar ... -w .`) so `npx cap sync` detects and binds every native plugin.

### 2. Android In-Place APK Update Incompatibility (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`)
* **Issue:** Sideloading a newly built APK over an existing installation failed with an error, forcing users to uninstall and lose local SQLite/Preferences cache.
* **Root Cause:** Default debug builds generate transient, randomized debug keystores with different SHA-256 certificate fingerprints on each build machine or CI run.
* **Resolution:** Checked in a persistent project keystore `android/app/freeform.keystore` and configured `signingConfigs.release` in `android/app/build.gradle` for both debug and release configurations. Version codes are derived dynamically from `package.json`.

### 3. Google Play Protect Sideload Warning
* **Issue:** Sideloading raw APKs on Android triggers Google Play Protect: *"App blocked to protect your device — Google doesn't recognise the developer"*.
* **Root Cause:** Android automatically flags newly signed APKs outside the Play Store whose certificate SHA-256 fingerprint has not been seen in the Google Play ecosystem before.
* **Resolution:** Users can tap **"More details" -> "Install anyway"**. For automated system-wide whitelisting without warnings, submit the APK to the [Google Play Protect Developer Appeals Portal](https://play.google.com/protect/feedback).

### 4. Android Capacitor `androidScheme: 'http'` for Mixed ws:// and wss://
* **Issue:** When `androidScheme` was set to `'https'`, Chromium WebView blocked unencrypted WebSocket (`ws://`) connections to local LAN / Tailscale IPs due to Strict Mixed Content security policies.
* **Resolution:** Configure `androidScheme: 'http'` in `capacitor.config.ts`. This permits both unencrypted `ws://` connections to LAN/Tailscale IPs as well as secure `wss://` connections to Cloudflare Tunnels and reverse proxy domains.

### 2. Reverse Proxies & Cloudflare Tunnels (`trustProxy: true`)
* Fastify requires `trustProxy: true` to properly parse headers (`x-forwarded-proto`, `x-forwarded-host`) from reverse proxies and Cloudflare Tunnels.

### 3. Android Chrome PWA Install Delay (~2 Minutes on LAN IPs)
* **Issue:** When installing the PWA on an Android phone over a local LAN IP (e.g. `http://192.168.x.x:3000`), Chrome takes ~2 minutes before the install prompt completes.
* **Root Cause:** Chrome on Android attempts to mint a native **WebAPK** package via Google's cloud servers (`webapk.googleapis.com`). Because private RFC 1918 IPs cannot be reached from the public internet, Google's minting server hangs until its 90–120s connection timeout expires, then falls back to a home screen shortcut.
* **Resolution:** This is standard Android behavior for private LAN IPs. Once deployed to a public domain with HTTPS (or via a tunnel like Cloudflare Tunnel or Tailscale Funnel), installation completes in **2–5 seconds**.

### 4. Web Manifest Requirements
Chrome strictly requires `start_url: "/"`, `scope: "/"`, `id: "/"`, and valid physical PNG icons (192x192 and 512x512) in `client/public/`. Without physical PNGs, Chrome refuses to trigger the native PWA install prompt.

### 5. Tailwind CSS Color Class Validation
Tailwind CSS does not generate fractional shade classes like `border-zinc-750` unless explicitly defined in `tailwind.config.js`. Using undefined color classes fails silently and produces transparent/missing borders. Always use standard palette values (e.g. `border-zinc-800`, `border-zinc-700/80`).

### 6. Database Foreign Keys and WAL Mode
`better-sqlite3` requires explicit execution of `PRAGMA foreign_keys = ON;` on every database connection. Without it, `ON DELETE CASCADE` and `ON DELETE SET NULL` constraints are silently ignored by SQLite.

### 7. Native Android Alarm Engine — Hard-Won Lessons

#### Duplicate notifications (triple-fire)
When a timer expires three notification systems were all firing independently:
1. `NativeTimer.startCountdownNotification` (Capacitor plugin, ID range 880000+)
2. `LocalNotifications.schedule` (Capacitor JS, separate ID range via getDeterministicNotifId)
3. `NativeAlarmReceiver` via `AlarmManager` (ID range 990000+)

**Resolution:** Remove `LocalNotifications.schedule` for timer completion entirely. `AlarmManager` + `NativeAlarmReceiver` is the single authoritative alarm delivery path. Only `LocalNotifications` for _reminders_ (not timers) is acceptable.

#### Stop Alarm flicker / re-ring loop
The in-app JS 1-second local ticker `setInterval` was re-setting dismissed timers back to `ringing` status because it checked `timer.status === 'running'` and `target_end_time <= now` without knowing the timer had been dismissed. Between the tap and the server `TIMER_DISMISSED` broadcast, the ticker fired and re-triggered the alarm modal.

**Resolution:**
1. **`locallyDismissedTimerIds`** — A `useRef<Set<string>>` in `RealtimeContext` tracks IDs dismissed locally. The ticker skips any ID in this set. IDs are added at the top of `dismissTimer()` (synchronously, before any async calls).
2. **Optimistic state update** — `dismissTimer()` calls `setTimers(prev => prev.map(...status:'dismissed'))` immediately before sending the WebSocket message or REST call, so the alarm modal closes instantly.
3. The ref is also checked in the `onNativeTimerAction('ring')` handler to prevent re-ringing a timer that was dismissed by another device.

#### Full-screen alarm on lock screen requires AlarmActivity, not MainActivity
`setFullScreenIntent` pointing to `MainActivity` does not reliably produce a full-screen takeover on Samsung One UI because `MainActivity` is a `singleTask` Capacitor WebView with complex launch flags. The OS may choose to post a heads-up banner instead.

**Resolution:** Create a dedicated `AlarmActivity` with `showWhenLocked="true"`, `turnScreenOn="true"`, `noHistory="true"`, `excludeFromRecents="true"`, styled with a simple dark alarm UI. Point both `setFullScreenIntent` and `context.startActivity()` at `AlarmActivity` from `NativeAlarmReceiver.onReceive`. The direct `startActivity` call ensures immediate display even on One UI.

#### One UI lock-screen live countdown widget requires IMPORTANCE_DEFAULT
Notification channels created with `IMPORTANCE_LOW` are suppressed from One UI's live notification "At a Glance" widget at the bottom of the lock screen. Only `IMPORTANCE_DEFAULT` and above qualify.

**Resolution:** Change the countdown channel from `NotificationManager.IMPORTANCE_LOW` to `NotificationManager.IMPORTANCE_DEFAULT` and pair with `setSound(null, null)` + `enableVibration(false)` to keep it silent but prominently visible.

**NOTE:** Notification channels cannot be changed after creation. If the old channel exists on the device with IMPORTANCE_LOW, the user must clear app data or manually change channel importance in Android Settings → Apps → Free Form → Notifications.

#### AlarmManager cancel must use FLAG_NO_CREATE
When cancelling an `AlarmManager` `PendingIntent`, use `FLAG_NO_CREATE` (not `FLAG_UPDATE_CURRENT`). `FLAG_UPDATE_CURRENT` creates a new PendingIntent if one doesn't exist, which does nothing useful and wastes resources. `FLAG_NO_CREATE` returns `null` if no matching intent exists (safe) and cancels it if it does.

#### Native audio vs. Web Audio isolation
On native Android, `NativeAlarmReceiver` plays the system alarm ringtone via `AlarmSoundManager` (using `RingtoneManager.TYPE_ALARM`). The JS layer's `startAlarmChime()` (Web Audio API synthesizer) must NOT be called on native. Running both simultaneously creates audio conflict.

**Resolution:** In `RealtimeContext`, wrap `startAlarmChime()` in `if (!isNative)`. The native alarm audio is entirely managed by `AlarmSoundManager.java` and stopped by `stopNativeAlarmSound()` → `NativeTimer.stopAlarm()` → `AlarmSoundManager.stopAlarm()`.

#### `onNativeTimerAction` listener must use refs to avoid stale closures
Registering `onNativeTimerAction` with an empty dependency array (`[]`) means the callback captures `dismissTimer` at mount time — when `socketRef.current` is `null`. Subsequent calls to `dismissTimer` via the listener will attempt to send to a null socket.

**Resolution:** Keep mutable refs `dismissTimerRef.current` and `pauseTimerRef.current` updated on every render (by assigning at the top of the component body). The stable listener (empty `[]`) calls through the ref, always accessing the latest function closure.

### 8. Android 16 Live Updates & Samsung One UI Now Bar Integration

#### Architecture
The Samsung "Now Bar" (capsule on the lock screen, Always-On Display, status bar chip, and top of notification panel) is Samsung's implementation of the **Android 16 Live Updates (Promoted Ongoing Notifications)** API level 36.

To integrate a third-party app into this surface:
1. **Manifest Permission:** Declare `<uses-permission android:name="android.permission.POST_PROMOTED_NOTIFICATIONS" />` (non-runtime install permission) and `<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />`.
2. **Foreground Service:** In Android 14+, live notifications must be hosted by a running `ForegroundService` with `foregroundServiceType="specialUse"` and property `PROPERTY_SPECIAL_USE_FGS_SUBTYPE="Live timer countdown"`. We implemented `TimerForegroundService.java`.
3. **Notification Builder Promotion:** Must call `setRequestPromotedOngoing(true)` (via reflection/API 36) and set the bundle extra `android.requestPromotedOngoing = true` on the notification.
4. **Style Compliance:** Must use an approved style (`NotificationCompat.BigTextStyle` or `ProgressStyle`) without custom `RemoteViews`, with `setOngoing(true)`, `setUsesChronometer(true)`, `setChronometerCountDown(true)`, `setCategory(CATEGORY_STOPWATCH)`, and `setVisibility(VISIBILITY_PUBLIC)`.
5. **Samsung Device Setting Gateways:**
   - **Show content on Lock Screen:** In app notification settings (or category settings for "Active Timer Countdowns"), `Lock screen` MUST be set to **"Show content"** (not "Hide content"). If set to "Hide content", One UI's Now Bar service explicitly suppresses the capsule from the lock screen.
   - **Developer Option ("Live notifications for all apps"):** In One UI 8+, Samsung defaults the Now Bar whitelist to select first-party/partner apps. Toggling **Developer Options → "Live notifications for all apps"** enables all compliant Android 16 Live Update notifications to enter the Now Bar capsule and status bar chip.




## 15. AI Agent Maintenance Protocol

Whenever an AI coding agent works in this repository:
1. **SSoT First:** Review `SSoT.md` at session start before proposing changes.
2. **Preserve Integrity:** Never bypass database pragmas, safe migrations, or type definitions.
3. **In-Repo Artifacts:** Mirror all implementation plans and walkthroughs into `.agents/artifacts/`.
4. **Mandatory Final Step:** **Always update `SSoT.md` and `README.md`** whenever features, schemas, or behaviors change.
5. **Verify Before Completion:** Execute `npm test --workspace=server` and `npm run build` to confirm 100% clean builds.
