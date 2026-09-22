# Free Form 🚀

> **A self-hostable, multi-modal markdown note-taking app and dynamic form engine.**  
> Native Markdown • Custom Reusable Form Templates • Interactive Counters • Web Bookmarks • Scrapbook Posters • Nested Notebooks • PWA

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-blue.svg)](docker-compose.yml)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-purple.svg)](client/vite.config.ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?logo=typescript&logoColor=white)](tsconfig.json)
[![Fastify](https://img.shields.io/badge/Fastify-v5-000000.svg?logo=fastify&logoColor=white)](https://fastify.dev/)
[![SQLite WAL](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57.svg?logo=sqlite&logoColor=white)](https://www.sqlite.org/)

---

## 🌟 Why Free Form?

Most note apps force you into one of two extremes:
1. **Unconstrained freeform text** (Obsidian, Bear, Apple Notes) where logging repetitive, structured information (such as vehicle logs, inspections, workouts, or daily standups) feels chaotic and inconsistent.
2. **Heavy relational databases** (Notion, Airtable) that are sluggish on mobile, proprietary, cloud-dependent, and lock your notes into closed formats.

**Free Form** bridges this divide. It is a clean, local-first note workspace where notes can be freely written in Markdown or created with structured, reusable form templates—complete with tallies, web bookmarks, and photo collages.

---

## 📸 Core Features

### 1. 📋 The "Free Form" Template System
* **Visual Template Builder**: Construct custom form templates with text fields, text areas, numeric steppers with units, dropdown selectors, checkboxes, star ratings (1–5), mini tables, signature pads, and section dividers.
* **Smart Defaults**: Date fields auto-default to today (`YYYY-MM-DD`), time fields auto-default to right now (`HH:MM`), and tables can be configured with a default number of blank rows.
* **Dual Representation (Form + Markdown)**: Submitting a form note stores raw JSON metadata **and** automatically generates formatted GitHub-Flavored Markdown. You can view it as a markdown note or re-open it in the form runner anytime.
* **Template-Bound Notebooks**: Bind a notebook to a default form template (e.g. "Car Maintenance" or "Daily Standup"). Tapping `+` inside that notebook immediately launches that form template.

### 2. 📝 Multi-Modal Note Types
* **Markdown Notes**: Rich text editing powered by TipTap (WYSIWYG) with code blocks, checklists, quotes, and an instant toggle to raw Markdown source code.
* **Interactive Counters**: One-tap tally counters with configurable step sizes, minimum/maximum limits, units, reset values, and a timestamped audit history log.
* **Webpage Bookmarks**: Paste any URL to automatically crawl and embed rich OpenGraph previews, site names, favicons, and thumbnail images.
* **Scrapbook Posters**: Photo collage cards for visual collections with image captioning and full-screen lightbox zoom.

### 3. 📁 Hierarchical Notebooks & Organization
* **Nested Notebooks**: Create parent/child hierarchies to whatever depth you need.
* **Sidebar Tree View**: Expandable/collapsible notebook tree with indentation, item counts, and quick hover actions to add sub-notebooks.
* **In-Notebook Breadcrumbs & Sub-Notebooks Grid**: When browsing inside a notebook, clickable breadcrumb paths and a top sub-notebooks card strip allow seamless navigation.
* **"Hide from All Items" Feed Protocol**: Flag individual notes or entire notebooks to be hidden from the global All Items feed so operational logbooks don't clutter your main view.
* **Feed Reveal Toggle**: A 1-click banner above your notes reveals hidden items whenever you want to inspect them without digging through settings.

### 4. 📱 Native Mobile PWA Experience
* **Fixed 5-Tab Bottom Navigation**: Native app navigation on mobile with direct access to All Notes, Notebooks, Quick Add (+), Templates, and Favorites.
* **Mobile Quick-Add Bottom Sheet**: Slides up smoothly with large touch targets (44px+) for one-tap creation.
* **Mobile Back Navigation**: In-notebook mobile headers feature a `< [Parent / All Notes]` back button for fluid navigation.
* **Offline Caching**: Built with `vite-plugin-pwa` and Workbox for fast cache-first asset loading and offline resilience.

### 5. 🗄️ Local-First & Exportable
* **Embedded SQLite WAL**: Zero-latency database with Write-Ahead Logging and automatic schema migrations.
* **One-Click Workspace Backup**: Download your entire workspace as a ZIP archive containing notebooks as folders, notes as clean `.md` files, and `free-form-backup.json`.

---

## 🚀 Quick Start

### Option A: Using Docker (Recommended for Self-Hosting)

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/free-form.git
   cd free-form
   ```

2. Build & run with the automated local test runner:
   ```bash
   ./scripts/test-local.sh
   # or
   npm run docker:test
   ```

3. Open **`http://localhost:3000`** in your browser!
   * All data (database and uploads) is persisted locally in `./data`.

*(Note: If running Docker without root, ensure your user is in the `docker` group: `sudo usermod -aG docker $USER`)*

---

### Option B: Local Node.js Development

Requirements: Node.js 20+ and npm.

1. Install workspace dependencies:
   ```bash
   npm install
   ```

2. Start development servers (Vite frontend on `:3000` + Fastify backend on `:3001` with hot-reload):
   ```bash
   npm run dev
   ```

3. Run backend unit tests:
   ```bash
   npm test --workspace=server
   ```

4. Build and start production bundle:
   ```bash
   npm run build
   npm start
   ```

---

## 📱 Mobile PWA Installation

Free Form passes all Progressive Web App installability criteria:
* **iOS Safari**: Tap the **Share** button -> **Add to Home Screen**.
* **Android Chrome**: Tap the **Three Dots** menu -> **Install App**.
* **Desktop (Chrome/Edge/Brave)**: Click the **Install** icon in the URL bar.

> [!NOTE]
> **Android LAN Installation Tip:** When installing on Android over a local LAN IP (e.g. `192.168.x.x`), Chrome's cloud WebAPK minting server cannot route to private IPs and waits for an internal timeout (~90–120s) before falling back. Once deployed with HTTPS on a domain (or via a tunnel like Cloudflare Tunnel or Tailscale Funnel), installation takes **2–5 seconds**.

---

## 🏛️ Project Architecture & Documentation

Free Form adheres to a strict **Single Source of Truth (SSoT)** protocol:
* **[`SSoT.md`](SSoT.md)**: The authoritative technical specification for system architecture, database schema, multi-modal engines, API contracts, mobile PWA details, and hard-won lessons.
* **[`AGENTS.md`](AGENTS.md)**: Guidelines and mandatory rules for autonomous coding agents.
* **[`.agents/artifacts/`](.agents/artifacts/)**: In-repo repository of architectural design plans, walkthroughs, and system reviews.

---

## 📄 License

MIT License © 2026 Free Form Contributors.
