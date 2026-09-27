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
* **Processed / Seen Status Tracking**: High-frequency form notes (daily inspections, intake sheets, logs) can be marked as "Processed / Seen" with a single tap. Processed entries are grayed out / dimmed and automatically collapse into a compact footprint in Grid View, making pending forms stand out.
* **Template-Bound Notebooks**: Bind a notebook to a default form template (e.g. "Car Maintenance" or "Daily Standup"). Tapping `+` inside that notebook immediately launches that form template.

### 2. 📝 Multi-Modal Note Types
* **Markdown Notes**: Rich text editing powered by TipTap (WYSIWYG) with bullet and numbered lists, code blocks, task checklists, quotes, and an instant toggle to raw Markdown source code.
* **Rich Markdown Card Previews**: Notes in the feed render authentic GitHub-Flavored Markdown directly on the card with headings, disc bullets, bold keys, and code tags, complete with individual accordion expand/collapse toggles.
* **Interactive Counters**: One-tap tally counters with configurable step sizes, minimum/maximum limits, units, reset values, and a timestamped audit history log.
* **Webpage Bookmarks**: Paste any URL to automatically crawl and embed rich OpenGraph previews, site names, favicons, and thumbnail images.
* **Scrapbook Posters**: Photo collage cards for visual collections with image captioning and full-screen lightbox zoom.

### 3. 📁 Hierarchical Notebooks & Organization
* **Nested Notebooks**: Create parent/child hierarchies to whatever depth you need.
* **Sidebar Tree View**: Expandable/collapsible notebook tree with indentation, item counts, and quick hover actions to add sub-notebooks.
* **In-Notebook Breadcrumbs & Sub-Notebooks Grid**: When browsing inside a notebook, clickable breadcrumb paths and a top sub-notebooks card strip allow seamless navigation.
* **"Hide from All Items" Feed Protocol**: Flag individual notes or entire notebooks to be hidden from the global All Items feed so operational logbooks don't clutter your main view.
* **Feed Reveal Toggle**: A 1-click banner above your notes reveals hidden items whenever you want to inspect them without digging through settings.

### 4. 📱 Native Mobile PWA & Android APK Polish
* **Full-Screen Alarm Takeover**: When a timer expires, `AlarmManager` fires `NativeAlarmReceiver` which immediately launches `AlarmActivity` — a dedicated full-screen activity that turns the screen on, overlays the lock screen, and presents a bold **STOP ALARM** button. No notification interaction required.
* **System Alarm Ringtone**: The expiry alarm uses your phone's actual system alarm sound (`RingtoneManager.TYPE_ALARM`) with looping vibration — plays until explicitly stopped.
* **One UI Lock-Screen Live Countdown**: Active timers post an `IMPORTANCE_DEFAULT` sticky notification with `setUsesChronometer(true)` + `setChronometerCountDown(true)`, qualifying it for Samsung One UI's "At a Glance" live widget at the bottom of the lock screen. Survives "Clear All."
* **Interactive Lock-Screen Controls**: `[⏸ Pause]` and `[⏹ Stop]` notification actions communicate natively back to the app and WebSocket engine for cross-device sync.
* **Single-Tap Reliable Stop**: A `locallyDismissedTimerIds` ref in `RealtimeContext` prevents the JS 1-second ticker from re-ringing a dismissed timer. Optimistic local state update ensures the alarm modal closes before the server round-trip.
* **No Duplicate Notifications**: Single `AlarmManager` + `NativeAlarmReceiver` path — no parallel `LocalNotifications` for timers. One timer = one alarm notification.
* **Bi-Directional Cross-Device Sync**: Dismissing on any connected device silences all others via WebSocket broadcast. Deleting a timer also cancels its `AlarmManager` entry.
* **Android 16 Live Updates & Samsung Now Bar Integration**: Running timers host a foreground service (`specialUse`) and request Promoted Ongoing status (`POST_PROMOTED_NOTIFICATIONS`, `setRequestPromotedOngoing`), enabling direct integration with Samsung One UI's Now Bar capsule at the top of the status bar, bottom of the lock screen, and top of the notification drawer.
* **Audio Isolation**: On native, Web Audio API synthesizer is bypassed — only `AlarmSoundManager.java` plays. On web/PWA, only the Web Audio chime plays. No dual-audio conflict.

* **Zero Status Bar Overlap**: Native status bar overlay is disabled (`overlay: false`) and coupled with dynamic CSS safe-area padding (`env(safe-area-inset-top)`), guaranteeing the Android clock, battery, and notification bar never overlap navbar icons or titles.
* **Live Top Bar Countdown Ticker**: Active timers update second-by-second directly inside the top navbar pill without needing to open the timers modal.
* **Refined Tactile Haptics**: Subtle, ultra-light mechanical tick on button and tab taps (`selectionChanged`), gentle bump on counter tallies (`ImpactStyle.Light`), and firm pulses on deletions and alarms.
* **OS-Level Background Timer & Reminder Alarms**: Android APK utilizes `@capacitor/local-notifications` with high-importance channels (`allowWhileIdle: true`) to ring alerts and vibrate even when the app is backgrounded or the phone is locked.
* **Zero Browser Popups (Native Confirm Dialogs)**: All `confirm()` popups are replaced with sleek, contextual in-app confirmation sheets on mobile and centered modals on desktop with danger/warning badges.
* **Fixed 5-Tab Bottom Navigation**: Native app navigation on mobile with active indicator pills, 56×56px FAB, and proper safe-area insets. Direct access to All Notes, Notebooks, Quick Add (+), Templates, and Favorites.
* **Native Bottom-Sheet Modals**: All modals (Note Editor, Form Runner, Bookmarks, Counters, Notebooks, Scrapbooks, Confirmations) slide up from the bottom on mobile, using `h-[97dvh]` for precise screen coverage. Full rounded corners on desktop, top-only on mobile.
* **Mobile Quick-Add Bottom Sheet**: Sheet with drag indicator handle. Each action row is 64px tall with 44×44px icon badge — comfortably tappable with any thumb size.
* **Touch-Friendly Controls**: All action buttons are minimum 44×44px (`h-10 w-10`). Counter +/- buttons are `h-14` on mobile for easy tapping. `touch-manipulation` on all interactive elements eliminates 300ms tap delay.
* **Foldable Phone Support (Z Fold 6)**: Optimized for ~360px inner screens. Compact navbar padding, taller filter chips, proper single-column layouts, and modal heights that fit the inner screen precisely.
* **iOS Polish**: `font-size: max(16px, 1em)` prevents auto-zoom on input focus. `overscroll-behavior: contain` prevents bounce-related layout jumps. Momentum scrolling via `-webkit-overflow-scrolling: touch`.
* **Mobile Back Navigation**: Navbar back button is `h-11` pill-shaped with brand accent chevron. Mobile search bar is `h-12`, auto-focuses on open, and closes cleanly on clear.
* **Offline Caching**: Built with `vite-plugin-pwa` and Workbox for fast cache-first asset loading and offline resilience.

### 5. 🗄️ Local-First & Exportable
* **Embedded SQLite WAL**: Zero-latency database with Write-Ahead Logging and automatic schema migrations.
* **One-Click Workspace Backup**: Download your entire workspace as a ZIP archive containing notebooks as folders, notes as clean `.md` files, and `free-form-backup.json`.

### 6. ⏱️ Universal Synced Timers & Reminders (Real-Time WebSockets)
* **Cross-Device Synchronized Timers**: Set a timer on your desktop, phone, or laptop and watch it count down simultaneously in real-time across all active sessions.
* **Universal Ringing & Dismissal**: When a timer reaches zero or a reminder triggers, **it rings all connected devices** with an audible alarm chime and alert modal. Dismissing or snoozing on any one device silences all devices instantaneously!
* **Zero External Dependencies**: Powered by `@fastify/websocket` on your existing self-hosted server and the browser's native Web Audio API (zero audio file 404s, 100% offline capable).
* **Scheduled Reminders**: Set reminders with dates, times, priority levels (Low, Normal, High), and notes. Snooze directly for 5m, 10m, or 15m.
* **Global Navigation Access**: Quick-start presets (1m, 5m, 10m, 15m, 25m Pomodoro, 30m, 1h), live countdown indicators in the top bar, and quick create shortcuts from the sidebar and mobile quick-add sheet.

### 7. 🎨 Settings, Theming & Note Priorities
* **Light, Dark & Follow System Themes**: Instant dynamic theming powered by CSS variable mapping of the zinc palette. Automatically follows your system preference (`prefers-color-scheme`) or allows manual selection.
* **Custom Color-Coded Priorities**: Configure priority labels (Low, Medium, High, Urgent, or custom) with preset swatches or hex colors in Settings. Note cards feature colored left border accents and badge pills; list rows show vertical priority indicator strips.
* **Prominent Connection Status & Auto-Reconnect**: Live connection status pill in Navbar (green pulsing when connected, red pulsing with retry action when offline), top offline notification banner with attempt counter, and instant reconnect on network recovery (`window.online`).

### 8. 📋 High-Density Compact List View
* **True Responsive List Mode**: Toggling from Grid to List view renders sleek `~60px` compact rows instead of full-size cards.
* **Inline Counter Increments**: Step counters up or down directly from the list row without opening any dialogs.
* **Fast Navigation**: Type badges, priority indicators, metadata snippets, and one-tap action buttons.

### 9. 📴 Offline-First Engine & Bi-Directional Sync
* **100% Offline Autonomy**: Full read and write capabilities without an active internet connection. All notes, forms, counters, bookmarks, and templates are stored locally in the device's persistent **IndexedDB** engine.
* **Reboot & Kill-Proof Outbox**: Edits made while offline are queued in a persistent local Outbox that survives app terminations and phone reboots.
* **Git-Style 3-Way Merge & Conflict Resolver**: Upon reconnection, changes merge automatically. When the same note is edited concurrently on multiple devices, the most recent version becomes active, while the other is preserved and flagged in the **Visual Diff & Merge Modal** where you can compare side-by-side and choose how to resolve.
* **Mathematical Counter Merging**: Tally increments sync as mathematical deltas (`+2`, `+5`), ensuring counters on different devices add together rather than overwriting.

### 10. 🎨 Brand Identity & Production Icon Suite
* **Handcrafted Vector Brand Icon**: A modern stylized "F" ribbon lettermark pairing sharp architectural arms with flowing cursive ribbon loops in neon cyber teal (`#48BEB6` -> `#55DBC7`) and electric blue (`#306ECE` -> `#3EAED7`), with 3D underside shadows.
* **Pure Mathematical Béziers**: 100% vector-authored SVG with zero auto-trace bumps or pixel staircasing.
* **Complete Asset Suite**: Scaled and generated for PWA 512×512, 192×192, iOS Apple Touch Icon (180×180), multi-size Windows favicon (16/32/48), and vector master SVG.
* **Airtight Cache Busting**: Server headers enforce `no-cache, no-store, must-revalidate` on HTML, Web Manifest, and Service Workers, combined with immutable content-hashed Vite bundles and cache-busting version query tags (`?v=2`) on all browser icon links.

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

## 📱 Mobile PWA & Native Android APK

### 1. Progressive Web App (PWA)
Free Form passes all Progressive Web App installability criteria:
* **iOS Safari**: Tap the **Share** button -> **Add to Home Screen**.
* **Android Chrome**: Tap the **Three Dots** menu -> **Install App**.
* **Desktop (Chrome/Edge/Brave)**: Click the **Install** icon in the URL bar.

> [!NOTE]
> **Android LAN Installation Tip:** When installing on Android over a local LAN IP (e.g. `192.168.x.x`), Chrome's cloud WebAPK minting server cannot route to private IPs and waits for an internal timeout (~90–120s) before falling back. Once deployed with HTTPS on a domain (or via a tunnel like Cloudflare Tunnel or Tailscale Funnel), installation takes **2–5 seconds**.

### 2. Native Android APK (Capacitor)
Free Form can be compiled into a standalone native Android `.apk` with OS-level background timer alarms, tactile haptics, and custom server switching:
* **Automated GitHub Actions Build**: Pushing to `main` or pushing a version tag (`v*`) automatically builds and attaches `free-form-vX.X.X.apk` (and `free-form.apk`) to workflow artifacts and GitHub Releases.
* **Local Build**:
  ```bash
  ./scripts/build-apk.sh
  ```
* **Connecting the APK to your Server**:
  On first launch (or anytime via **Settings -> System**), enter your Free Form server URL (e.g. `http://192.168.1.50:3000` or your custom domain) and tap **Save & Test**. The APK stores your server URL locally and immediately syncs!

---

## 🏛️ Project Architecture & Documentation

Free Form adheres to a strict **Single Source of Truth (SSoT)** protocol:
* **[`SSoT.md`](SSoT.md)**: The authoritative technical specification for system architecture, database schema, multi-modal engines, API contracts, mobile PWA details, and hard-won lessons.
* **[`AGENTS.md`](AGENTS.md)**: Guidelines and mandatory rules for autonomous coding agents.
* **[`.agents/artifacts/`](.agents/artifacts/)**: In-repo repository of architectural design plans, walkthroughs, and system reviews.

---

## 📄 License

MIT License © 2026 Free Form Contributors.
