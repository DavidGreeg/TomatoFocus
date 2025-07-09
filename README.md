# Pomodoro Timer Chrome Extension

A minimal, customisable **Pomodoro timer** for Google Chrome with desktop notifications and sound alarms. It helps you stay focused by timing work/break cycles — and a built‑in website blocker is on the roadmap.

> **Status:** MVP complete – work/break cycles, per‑session sounds, custom durations. Roadmap includes a long‑break option and optional site‑blocking.

---

## Features

| Feature                     | Description                                                                       |
| --------------------------- | --------------------------------------------------------------------------------- |
| ⏱ Custom cycles             | Set *work minutes*, *break minutes*, and *number of cycles* directly in the popup |
| 🔔 Sound alarms             | Plays `start`, `work`, `break`, and `finish` MP3 alerts (replaceable)             |
| 💾 Persistent state         | Timer keeps running even if you close the popup or browser windows                |
| 🔋 Pause/Resume             | Freezes the countdown and resumes later — timer display stays correct             |
| 📢 Desktop notifications    | Toast messages at every transition                                                |
| 🪄 **Planned**: long break      | Configurable long break after *N* cycles                                          |
| 🚫 **Planned**: website blocker | Block distracting sites while the work timer is active                            |

---

## Installation (dev mode)

1. **Clone** or download this repo.
2. Chrome → `chrome://extensions` → toggle **Developer mode**.
3. Click **Load unpacked** → select the `pomodoro-timer/` folder.
4. Pin the tomato icon (optional).

> **Sound files:** Drop your own 128‑kbps MP3s into `sounds/` named `start.mp3`, `work.mp3`, `break.mp3`, `finish.mp3` (or keep the defaults).

---

## Usage

1. Click the extension icon.
2. Open **⚙ Settings**.
3. Enter *Work (min)*, *Break (min)*, *Cycles*, and (soon) *Long break*.
4. Hit **Save** → **Test sound** once to unlock autoplay.
5. Press **Start**.

Button states:

| Button     | Meaning                          |
| ---------- | -------------------------------- |
| **Start**  | Begin a fresh session            |
| **Pause**  | Freeze current timer             |
| **Resume** | Continue a paused session        |
| **Reset**  | Stop everything & reset counters |

---

## Development

```bash
# one‑time setup
git clone https://github.com/<your‑user>/pomodoro-timer.git
cd pomodoro-timer

# after changes
npm run lint   # coming soon – ESLint/Prettier setup
# reload via chrome://extensions
```

### Key files

| File                      | Purpose                                                  |
| ------------------------- | -------------------------------------------------------- |
| `manifest.json`           | Manifest V3 definition                                   |
| `service_worker.js`       | Background timer, state, notifications, off‑screen audio |
| `popup.html / .js / .css` | User interface                                           |
| `offscreen.html / .js`    | Hidden page that actually plays the MP3s                 |

---

## Roadmap

Contributions welcome via PR or discussion! Feel free to fork and customise.

---
