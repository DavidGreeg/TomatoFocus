/***** defaults *****/
const DEF = { work: 25, break: 5, cycles: 4 };
let SET   = { ...DEF };

/***** state *****/
// let st = { mode: "work", running: false, end: null, cycle: 0, total: SET.cycles };
let st = { mode: "work", running: false, end: null, cycle: 0, total: SET.cycles, workDone: 0 };

/***** boot *****/
chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);
async function init() {
  const { settings, state } = await chrome.storage.local.get(["settings", "state"]);
  if (settings) SET = { ...DEF, ...settings };
  if (state)    st  = { ...st,  ...state    };
  st.total = SET.cycles;
  await ensureOffscreen();
  tick();
}

/***** off‑screen helper *****/
async function ensureOffscreen() {
  // Return true if an off‑screen document is available (or not required), false otherwise.
  if (!chrome.offscreen?.createDocument) return false;            // API unavailable
  if (await chrome.offscreen.hasDocument()) return true;          // already there

  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("offscreen.html"),
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "Pomodoro alarms"
    });
    // Wait a moment for the new document to load
    await new Promise(r => setTimeout(r, 150));
    return true;
  } catch (err) {
    console.warn("Off‑screen creation failed", err);
    return false;
  }
}

async function play(sound) {
  const ready = await ensureOffscreen();
  if (ready) {
    chrome.runtime.sendMessage({ cmd: "playSound", sound }).catch(() => {});
  } else {
    // Fallback: broadcast to any open popup to play locally (not ideal but better than silence)
    chrome.runtime.sendMessage({ cmd: "playSoundPopup", sound }).catch(() => {});
  }
}

/***** main clock *****/
setInterval(tick, 1000);
function tick() {
  if (st.running && st.end) {
    const now = Date.now();
    if (now >= st.end) transition(now);
  }
  broadcast();
  chrome.storage.local.set({ state: st });
}

function transition(now) {
  if (st.mode === "work") {
    // Finished a work block ➜ either session complete or start a break
    st.workDone = (st.workDone ?? 0) + 1;   // count finished works

    if (st.workDone >= SET.cycles) {
      // All required Work blocks completed – session ends here
      play("finish");
      notify("Pomodoro complete", "Great job – session done!");
      st = { mode: "work", running: false, end: null, cycle: 0, total: SET.cycles, workDone: 0 };
      return;
    }

    // Otherwise start a break
    st.mode = "break";
    st.end  = now + SET.break * 60000;
    play("break");
    notify("Break time!", `Relax ${SET.break} min.`);
  } else {
    // Finished a break ➜ start next work
    st.cycle++;
    st.mode = "work";
    st.end  = now + SET.work * 60000;
    play("work");
    notify("Back to work!", `Cycle ${st.cycle + 1}/${SET.cycles}`);
  }
}

/***** messaging *****/
function broadcast() {
  const rem = st.pauseMs ?? (st.end ? Math.max(0, st.end - Date.now()) : 0); // Change remaining time display
  chrome.runtime.sendMessage({
    cmd: "tick",
    state: {
      mode: st.mode,
      running: st.running,
      paused: Boolean(st.pauseMs), // Also part of change
      cycle: st.cycle,
      totalCycles: st.total,
      minutes: Math.floor(rem / 60000),
      seconds: Math.floor((rem % 60000) / 1000)
    }
  }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  switch (msg.cmd) {
    case "getState": {
      const rem = st.end ? Math.max(0, st.end - Date.now()) : 0;
      reply({
        mode: st.mode,
        running: st.running,
        cycle: st.cycle,
        totalCycles: st.total,
        minutes: Math.floor(rem / 60000),
        seconds: Math.floor((rem % 60000) / 1000)
      });
      break;
    }
    case "toggle": {
      if (st.running) {
        st.pauseMs = st.end - Date.now();
        st.running = false;
        st.end     = null;
      } else {
        const base = st.pauseMs ?? SET[st.mode] * 60000;

        // Play “start” ONLY when kicking off a *new* session
        if (!st.pauseMs && st.cycle === 0 && st.mode === "work") play("start");

        st.running = true;
        st.end     = Date.now() + base;
        delete st.pauseMs;
      }
      break;
    }
    case "reset": {
      // st = { mode: "work", running: false, end: null, cycle: 0, total: SET.cycles };
      st = { mode: "work", running: false, end: null, cycle: 0, total: SET.cycles, workDone: 0 };
      break;
    }
    case "settingsUpdated": {
      chrome.storage.local.get(["settings"], ({ settings }) => {
        SET = { ...DEF, ...settings };
        st.total = SET.cycles;
      });
      break;
    }
    case "playSound": {
      play(msg.sound);
      break;
    }
  }
});

/***** notifier *****/
function notify(title, message) {
  chrome.notifications.create({ type: "basic", iconUrl: "icons/icon128.png", title, message });
}
