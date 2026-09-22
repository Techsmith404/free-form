# 🏛️ Free Form: Single Source of Truth (SSoT)

> **Document Version:** 1.0.0  
> **Last Updated:** September 22, 2026  
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
6. [Notebook Hierarchy & Organization Architecture](#6-notebook-hierarchy--organization-architecture)
7. [Card Presentation & Expansion Architecture](#7-card-presentation--expansion-architecture)
8. [Native Mobile PWA Architecture](#8-native-mobile-pwa-architecture)
9. [REST API Catalog & Endpoint Specifications](#9-rest-api-catalog--endpoint-specifications)
10. [Containerization, Self-Hosting & Local Testing](#10-containerization-self-hosting--local-testing)
11. [Critical Workarounds, Gotchas & Hard-Won Lessons](#11-critical-workarounds-gotchas--hard-won-lessons)
12. [AI Agent Maintenance Protocol](#12-ai-agent-maintenance-protocol)

---

## 1. Project Overview & Philosophy

**Free Form** is an open-source, self-hostable, multi-modal note-taking platform and structured form engine. It is designed to bridge the gap between two existing extremes:
1. **Unstructured freeform text apps** (Obsidian, Bear, Apple Notes) that lack native repeatability for structured logs, checklists, equipment checks, and day-to-day data entry.
2. **Heavy cloud relational databases** (Notion, Airtable) that suffer from mobile latency, vendor lock-in, proprietary data formats, and internet dependence.

### Core Tenets

* **Local-First & Air-Gapped Autonomy:** Runs 100% self-hosted via Docker or bare Node.js with zero mandatory internet connections. Data lives in an embedded SQLite database (`freeform.db`) alongside local file uploads.
* **Dual Representation (Form + Markdown):** Every structured form note maintains both machine-readable JSON metadata (for re-opening in form builders/runners) and clean, human-readable GitHub-flavored Markdown text.
* **Multi-Modal Expressiveness:** Notes are not restricted to plain text; they encompass rich WYSIWYG markdown, dynamic structured forms, interactive tally counters, rich web bookmarks, and photo scrapbook collages.
* **Hierarchy Without Clutter:** Full support for nested notebook trees, accompanied by a strict "Hide from All Items" feed exclusion protocol so high-frequency logbooks do not overwhelm the main workspace feed.
* **True Native Mobile Experience:** Progressive Web App (PWA) with a dedicated 5-tab fixed bottom navigation bar, quick-add mobile bottom sheet, hierarchical back navigation, touch targets >= 44px, and offline Workbox asset caching.

---

## 2. System Architecture & Technology Stack

```
free-form/
├── client/                     # Vite + React 18 PWA Frontend
│   ├── public/                 # Favicons, Web Manifest, PWA PNG icons (192, 512)
│   ├── src/
│   │   ├── api/                # Typed fetch client (Items, Notebooks, Templates, Uploads)
│   │   ├── components/
│   │   │   ├── editor/         # TipTap WYSIWYG & Source Markdown Editor
│   │   │   ├── forms/          # Form Runner Modal & Template Builder Modal
│   │   │   ├── items/          # Cards: Note, FormEntry, Counter, Bookmark, Poster
│   │   │   ├── layout/         # Sidebar (hierarchical tree), Navbar (filters, mobile back)
│   │   │   ├── modals/         # New Notebook, Bookmark, Counter, Poster, Markdown Viewer
│   │   │   └── views/          # Templates View
│   │   ├── types/              # Frontend TypeScript Interfaces & Types
│   │   ├── App.tsx             # Main Application Shell & Navigation Controller
│   │   ├── index.css           # Tailwind base, touch action & custom scrollbars
│   │   └── main.tsx            # React root & Service Worker registration
│   └── vite.config.ts          # Vite configuration & VitePWA Workbox setup
├── server/                     # Fastify 5 + SQLite Backend
│   ├── src/
│   │   ├── db/                 # better-sqlite3 connection, WAL pragma, schema & migrations
│   │   ├── routes/             # REST routes: items, notebooks, templates, upload, export
│   │   ├── services/           # Form-to-Markdown generation & OpenGraph scraper
│   │   ├── types/              # Backend TypeScript Interfaces & Types
│   │   ├── index.ts            # Fastify server bootstrap & static file serving
│   │   └── index.test.ts       # Vitest unit test suite
│   └── tsconfig.json
├── data/                       # Persistent Host Volume (SQLite DB + Uploaded Assets)
│   ├── freeform.db             # Primary SQLite WAL database
│   └── uploads/                # User uploaded images and canvas signature SVGs/PNGs
├── scripts/
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
| **Database** | SQLite via `better-sqlite3` | Zero-latency embedded database, synchronous execution in WAL mode. |
| **Frontend Framework** | React 18 + TypeScript | Componentized declarative UI with strict type safety. |
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
  is_favorite INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  is_archived INTEGER DEFAULT 0,
  hide_from_all INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_items_notebook ON items(notebook_id);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_counter_history_item ON counter_history(item_id);
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

---

## 6. Notebook Hierarchy & Organization Architecture

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
* **Feed Reveal Toggle:** When browsing the global All Items feed, if hidden items exist, an interactive banner displays: `[👁 N hidden items excluded from feed (click to reveal)]`, allowing instant 1-click inspection without changing settings.

---

## 7. Card Presentation & Expansion Architecture

All item cards feature uniform styling with high contrast:
* **Tactile Styling:** `border border-zinc-800 bg-zinc-900/95 shadow-md hover:border-zinc-700/80 active:scale-[0.98]`.
* **Rich Form Note Previews:** [`FormEntryCard.tsx`](file:///home/codaine/Projects/free-form/client/src/components/items/FormEntryCard.tsx) directly renders filled field values, including golden star ratings (`★`), status badge pills, mini-tables, key-value data with units, and signature thumbnails.
* **Accordion Controls:**
  * Each form card features an individual **"Show Details" / "Less Details"** chevron toggle.
  * The top Navbar features a global **Expand All / Collapse All** (`ChevronsUpDown`) toggle.
  * **Template-Bound Notebooks Expand by Default:** Opening a notebook bound to a form template automatically defaults all cards to expanded.

---

## 8. Native Mobile PWA Architecture

Free Form delivers an authentic mobile app experience on iOS and Android:

### 1. Fixed Bottom Navigation Bar (`lg:hidden`)
A fixed native bottom tab bar provides immediate 1-tap navigation:
1. **All Notes (`FileText`):** Jumps to the root feed.
2. **Notebooks (`Folder`):** Opens the mobile notebook drawer.
3. **Elevated Center Action (`+` FAB):** Prominent circular button with tap haptics/micro-animation.
4. **Templates (`ClipboardList`):** Opens the form templates catalog.
5. **Favorites (`Star`):** Filters to favorited items.
* Fully respects mobile safe area: `pb-[max(env(safe-area-inset-bottom),0.5rem)]`.

### 2. Mobile Quick-Add Action Sheet
Tapping the center `+` button opens a native slide-up bottom sheet with large (44px+) touch targets to create a Note, Form Entry, Counter, Bookmark, Scrapbook, or Sub-Notebook.

### 3. Mobile Header Back Navigation
When navigating inside a notebook on mobile, [`Navbar.tsx`](file:///home/codaine/Projects/free-form/client/src/components/layout/Navbar.tsx) replaces the hamburger menu with a prominent **`< [Parent / All Notes]`** back button for fluid navigation.

### 4. Touch & Gesture Polish
* `-webkit-tap-highlight-color: transparent` eliminates mobile tap flashing.
* `touch-action: manipulation` eliminates the 300ms double-tap zoom delay on buttons.

---

## 9. REST API Catalog & Endpoint Specifications

All endpoints are hosted under `/api/*` on Fastify:

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
* `POST /api/items`: Creates an item. If `type === 'form_entry'`, auto-generates markdown.
* `PUT /api/items/:id`: Updates an item. If form values change, updates markdown.
* `DELETE /api/items/:id`: Soft deletes (`is_archived = 1`) or permanent delete (`?permanent=1`).

### Counter Actions (`/api/items/:id/counter`)
* `POST /api/items/:id/counter`: Adjusts counter (`delta`, `reset`, `setValue`, `note`). Automatically records to `counter_history`.
* `GET /api/items/:id/counter-history`: Retrieves chronological audit trail for a counter.

### Templates (`/api/templates`)
* `GET /api/templates`: Lists all form templates with usage counts.
* `POST /api/templates`: Creates a form template with `fields_schema`.
* `PUT /api/templates/:id`: Updates a form template.
* `DELETE /api/templates/:id`: Deletes a form template.

### Utilities
* `POST /api/bookmarks/scrape`: Crawls a URL to extract OpenGraph metadata (`og:title`, `og:description`, `og:image`, `favicon`).
* `POST /api/upload`: Multipart file upload for images and signatures; saved to `./data/uploads/`.
* `GET /api/export`: Generates and streams a full workspace backup ZIP containing markdown files and `free-form-backup.json`.
* `GET /api/health`: Health check returning `{ status: 'ok', time: '...' }`.

---

## 10. Containerization, Self-Hosting & Local Testing

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

## 11. Critical Workarounds, Gotchas & Hard-Won Lessons

### 1. Android Chrome PWA Install Delay (~2 Minutes on LAN IPs)
* **Issue:** When installing the PWA on an Android phone over a local LAN IP (e.g. `http://192.168.x.x:3000`), Chrome takes ~2 minutes before the install prompt completes.
* **Root Cause:** Chrome on Android attempts to mint a native **WebAPK** package via Google's cloud servers (`webapk.googleapis.com`). Because private RFC 1918 IPs cannot be reached from the public internet, Google's minting server hangs until its 90–120s connection timeout expires, then falls back to a home screen shortcut.
* **Resolution:** This is standard Android behavior for private LAN IPs. Once deployed to a public domain with HTTPS (or via a tunnel like Cloudflare Tunnel or Tailscale Funnel), installation completes in **2–5 seconds**.

### 2. Web Manifest Requirements
Chrome strictly requires `start_url: "/"`, `scope: "/"`, `id: "/"`, and valid physical PNG icons (192x192 and 512x512) in `client/public/`. Without physical PNGs, Chrome refuses to trigger the native PWA install prompt.

### 3. Tailwind CSS Color Class Validation
Tailwind CSS does not generate fractional shade classes like `border-zinc-750` unless explicitly defined in `tailwind.config.js`. Using undefined color classes fails silently and produces transparent/missing borders. Always use standard palette values (e.g. `border-zinc-800`, `border-zinc-700/80`).

### 4. Database Foreign Keys and WAL Mode
`better-sqlite3` requires explicit execution of `PRAGMA foreign_keys = ON;` on every database connection. Without it, `ON DELETE CASCADE` and `ON DELETE SET NULL` constraints are silently ignored by SQLite.

---

## 12. AI Agent Maintenance Protocol

Whenever an AI coding agent works in this repository:
1. **SSoT First:** Review `SSoT.md` at session start before proposing changes.
2. **Preserve Integrity:** Never bypass database pragmas, safe migrations, or type definitions.
3. **In-Repo Artifacts:** Mirror all implementation plans and walkthroughs into `.agents/artifacts/`.
4. **Mandatory Final Step:** **Always update `SSoT.md` and `README.md`** whenever features, schemas, or behaviors change.
5. **Verify Before Completion:** Execute `npm test --workspace=server` and `npm run build` to confirm 100% clean builds.
