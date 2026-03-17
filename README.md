# TomatoFocus – Chrome Pomodoro + Website Blocker

TomatoFocus is a Chrome extension that combines a Pomodoro timer with a schedule-based website blocker.

It is built with Manifest V3 and keeps timer + blocker logic in a background service worker so sessions keep working when the popup is closed.

---

## ✨ Current functionality

### ⏱️ Pomodoro timer
- **Custom durations** for work minutes, short break minutes, and cycle count.
- **Optional long breaks** with configurable duration and frequency (e.g., every 4 work blocks).
- **Start / Pause / Resume / Reset** controls ▶️⏸️🔁
- **Accurate remaining time while paused** (resume continues from exact remaining time).
- **Session completion behavior**: after the configured number of work blocks, the timer stops and resets ✅
- **Desktop notifications** at key transitions (break start, work resume, completed session) 🔔
- **Persistent state** using `chrome.storage.local`, so timer state survives popup close/reopen 💾

### 🔊 Sound system
- Uses an **offscreen document** for reliable background audio playback.
- Supports these sound events:
  - `start` (session starts) 🚀
  - `work` (work block starts) 🧠
  - `break` (short break starts) ☕
  - `finish` (session finished) 🏁
  - sequential playback is supported (used for long-break cue sequence).
- If offscreen playback is unavailable, popup playback fallback is used.

### 🚫 Website blocker
- **Active (implemented)** schedule-based blocking via `declarativeNetRequest` dynamic rules.
- Blocks both:
  - **domain entries** (e.g., `youtube.com`) 🌐
  - **regex entries** (named rules with custom regex patterns) `.*`
- Includes a **default site list** on first run and supports adding/removing entries.
- During active schedule windows, blocked URLs are **redirected to `redirect-page.html`** ↪️
- Outside schedule windows, blocker rules are removed automatically.
- Dynamic rules are refreshed when sites/schedules change and periodically to stay in sync.

### 🗓️ Block schedule
- Create one or more blocking intervals in **HH:MM → HH:MM** format.
- Intervals are validated to prevent invalid values and overlaps.
- Current default interval is initialized on first run (`00:00–04:00`) if none exists.

### 🔐 Content lock + password protection
- Optional **user password** can be enabled in Settings.
- Password validation rules: **4–24 chars**, includes at least **one letter** and **one number**.
- When enabled, site-list and schedule editing can be content-locked.
- Unlocking requires password verification.

### 🧭 Popup navigation/UI
- Left-nav popup with sections for:
  - Pomodoro ⏱️
  - Website Block → Sites List / Time Schedule 🚫
  - Settings ⚙️
- Habit Tracker button exists in navigation UI, but no tracker functionality is wired yet 🛠️

---

## 🧩 Installation (development)

1. Clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repository folder.

---

## 🚀 Usage

1. Open the extension popup.
2. In **Pomodoro**, set timer values and save settings.
3. Start your session with **Start**.
4. In **Website Block → Sites List**, add/remove blocked domains or regex rules.
5. In **Website Block → Time Schedule**, define intervals when blocking should be active.
6. Optional: enable password protection in **Settings**.

---

## 🗂️ Project structure

- `manifest.json` – MV3 permissions, popup, background, host permissions.
- `service_worker.js` – timer engine, notifications, blocker rule installation, schedule checks.
- `popup.html` / `popup.js` / `popup.css` / `popup_tailwind.css` – popup UI and interactions.
- `offscreen.html` / `offscreen.js` – background audio playback.
- `redirect-page.html` / `redirect-page.css` – page shown when a request is blocked.

---

## 📝 Notes

- The extension requests broad host access (`<all_urls>`) to support user-defined website blocking.
- `practice/tooltips.html` is an isolated practice/demo file and not part of runtime extension behavior.
