# Free Form 🚀

> **A self-hostable, multi-modal markdown note-taking app and dynamic form engine.**  
> Native Markdown • Custom Reusable Form Templates • Interactive Counters • Web Bookmarks • Scrapbook Posters • PWA

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-blue.svg)](docker-compose.yml)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-purple.svg)](client/vite.config.ts)

---

## 🌟 Why Free Form?

Most note apps force you into one of two extremes:
1. **Unconstrained freeform text** (Obsidian, Bear, Apple Notes) where logging repetitive, structured information (like vehicle maintenance, daily workouts, job inspections, or habit reviews) feels chaotic and inconsistent.
2. **Heavy relational databases** (Notion, Airtable) that are sluggish on mobile, proprietary, cloud-dependent, and hoard your data in locked-in formats.

**Free Form** bridges this divide. It's a clean, local-first note workspace where a notebook page can be:
- 📝 **A Rich Markdown Note**: Write freely with TipTap WYSIWYG or toggle to raw Markdown source code anytime.
- 📋 **A "Free Form" Structured Note (The Signature Gimmick)**: Design custom form templates (with text fields, numeric steppers with units, dropdowns, ratings, dynamic tables, and signature canvas) and fill them out repeatedly into any notebook.
- 🔢 **An Interactive Counter**: One-tap increment/decrement counters with customizable step sizes, units, and timestamped activity logs.
- 🔖 **A Webpage Bookmark**: Paste any link to scrape rich OpenGraph previews, thumbnails, and descriptions with personal annotations.
- 🖼️ **A Scrapbook Poster**: Visual collage cards for photos and mood boards with a lightbox zoom view.

---

## 📸 Core Features

### 1. The "Free Form" Template System
- **Drag-and-Drop / Reorderable Template Builder**: Build schemas with header dividers, text areas, number steppers, dropdowns, checkboxes, star ratings, dynamic tables, and touch/mouse signature pads.
- **Dual Representation**: Entries store structured JSON data (so you can re-open and edit them in the form runner anytime) **and** auto-generate clean, readable Markdown documents with YAML frontmatter.
- **Template-Bound Notebooks**: Bind a notebook to a default template (e.g. a "Daily Standup" or "Car Log" notebook). Tapping `+` immediately opens that form template.

### 2. Multi-Modal Note Types
- **Markdown Editor (WYSIWYG + Source Toggle)**: Real-time rich text editor powered by TipTap with support for checklists, code blocks, tables, image uploads, and an instant toggle to raw Markdown.
- **Tally Counters**: Fast +/- adjustments, reset buttons, and an audit trail log.
- **Rich Bookmarks**: Automatic OpenGraph metadata scraping and favicon discovery.
- **Scrapbook Galleries**: Multi-image photo grids with captioning and lightbox modal.

### 3. Notebook Organization
- Hierarchical notebooks with custom color dots and icons.
- Instant search across titles, markdown content, and tags.
- Filter by item type (Notes, Form Entries, Counters, Bookmarks, Scrapbooks).
- Favorites, Pinned items, and Trash recovery.
- **One-Click Workspace Export**: Download your entire workspace as a ZIP archive containing notebooks as folders, notes as clean `.md` files, and `free-form-backup.json`.

---

## 🚀 Quick Start

### Option A: Using Docker (Recommended for Self-Hosting)

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/free-form.git
   cd free-form
   ```

2. Start the container:
   ```bash
   docker compose up -d
   ```

3. Open **`http://localhost:3000`** in your browser!
   - All your data (SQLite database, file uploads, and signatures) is persisted in the local `./data` volume.

*(Note: If running Docker without root, ensure your user is in the `docker` group: `sudo usermod -aG docker $USER`)*

---

### Option B: Local Node.js Development

Requirements: Node.js 18+ and npm.

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development servers (Vite frontend on `:3000` + Fastify backend on `:3001` with hot-reload):
   ```bash
   npm run dev
   ```

3. Build and run production server:
   ```bash
   npm run build
   npm start
   ```

---

## 📱 Mobile PWA Installation

Free Form is built as a Progressive Web App (PWA):
- **iOS Safari**: Tap the **Share** button -> **Add to Home Screen**.
- **Android Chrome**: Tap the **Three Dots** menu -> **Install App**.
- **Desktop (Chrome/Edge/Brave)**: Click the **Install** icon in the URL bar.

Enjoy full-screen standalone app experience with offline asset caching.

---

## 🏗️ Technical Architecture

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, TipTap Editor, Lucide Icons, Vite-PWA.
- **Backend**: Node.js, Fastify, TypeScript, Cheerio (OpenGraph scraping), Archiver (ZIP backup).
- **Database**: SQLite (via `better-sqlite3`) in high-performance WAL mode. Single-file database (`freeform.db`) with zero maintenance.
- **Storage**: Local uploads directory (`/data/uploads`).

---

## 🧪 Testing

Run backend unit and integration tests:
```bash
npm test
```

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
