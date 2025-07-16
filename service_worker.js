/***** defaults *****/
// Default sites are stored by popup.js under `defaultSites` in chrome.storage
const RULE_ID_BASE = 1000; // avoid collision with future dynamic rules
// chrome.declarativeNetRequest.testMatchOutcome({request: { url: "https://www.youtube.com/", type: "main_frame" }, tabId: -1}, r => console.log(r));

const DEF = { work: 25, break: 5, cycles: 4, longBreak: 15, longBreakEvery: 4, enableLongBreak: true };
let SET   = { ...DEF };

/***** state *****/
// let st = { mode: "work", running: false, end: null, cycle: 0, total: SET.cycles };
let st = { mode: "work", running: false, end: null, cycle: 0, total: SET.cycles, workDone: 0 };

/***** boot *****/
chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);
async function init() {
  const { settings, state, defaultSites = [], userBlockedSites } = await chrome.storage.local.get(["settings", "state", "defaultSites", "userBlockedSites"]);
  if (settings) SET = { ...DEF, ...settings };
  if (!SET.enableLongBreak) SET.longBreakEvery = Infinity;
  if (state)    st  = { ...st,  ...state    };
  st.total = SET.cycles;

  if (!Array.isArray(userBlockedSites)) {
    await chrome.storage.local.set({ userBlockedSites: Array.isArray(defaultSites) ? [...defaultSites] : [] });
  }

  // off-screen doc (for sounds)
  await ensureOffscreen();
  // permanent block rules
  await installBlockerRules();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.userBlockedSites || changes.defaultSites)) {
      installBlockerRules();
    }
  });

  // start timer loop
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

function playSeq(arr) {
  ensureOffscreen().then(() =>
    chrome.runtime.sendMessage({ cmd: "playSoundSeq", sounds: arr }).catch(()=>{})
  );
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

    // Determine break length (long or short)
    const long = SET.enableLongBreak && (st.workDone % SET.longBreakEvery === 0);
    const mins = long ? (SET.longBreakMin ?? SET.longBreak ?? SET.break) : SET.break;
    st.mode = long ? "longBreak" : "break";
    st.end  = now + mins * 60000;

    if (long) {
      playSeq(["break", "longbreak"]);
    } else {
      play("break")
	}

    notify(long ? "Long break!" : "Break time!", `Relax ${mins} min.`);
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
        seconds: Math.floor((rem % 60000) / 1000),
        longBreak: SET.longBreak,
        longBreakEvery: SET.longBreakEvery
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
        if (!SET.enableLongBreak) SET.longBreakEvery = Infinity;
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

/* ------------------------
 *    WEBSITE BLOCKER
 * ------------------------ */
async function installBlockerRules () {
  const { userBlockedSites = [], defaultSites = [] } = await chrome.storage.local.get(['userBlockedSites','defaultSites']);
  const combinedSites = Array.isArray(defaultSites) ? [...defaultSites] : [];
  for (const site of userBlockedSites) {
    if (typeof site === 'string') {
      if (!combinedSites.includes(site)) combinedSites.push(site);
    } else {
      combinedSites.push(site);
    }
  }
  /* ---------------------------------
     0. Remove *all* existing rules
     --------------------------------- */
  const all = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: all.map(r => r.id),   // nuke everything
    addRules: []
  });

  /* ---------------------------------
     1. Build fresh redirect rules
     --------------------------------- */
  const rules = combinedSites.map((entry, i) => {
    const baseId = RULE_ID_BASE + i;
    if (typeof entry === 'string') {
      // plain host  →  urlFilter with ABP anchors
      return {
        id: baseId,
        priority: 1,
        action: { type: 'redirect',
                  redirect: { url: 'https://www.google.com/' } },
        condition: {
          urlFilter: `||${entry}^`,
          resourceTypes: ["main_frame", "sub_frame", "stylesheet", "script", "image",
                          "font", "object", "xmlhttprequest", "ping", "csp_report",
                          "media", "websocket", "other"]
        }
      };
    }

    // { regex: '...' } → regexFilter rule
    return {
      id: baseId,
      priority: 1,
      action: { type: 'redirect',
                redirect: { url: 'https://www.google.com/' } },
      condition: {
        regexFilter: entry.regex,
        resourceTypes: ["main_frame", "sub_frame", "stylesheet", "script", "image",
                        "font", "object", "xmlhttprequest", "ping", "csp_report",
                        "media", "websocket", "other"]
      }
    };
  });

  /* ---------------------------------
     2. Add them
     --------------------------------- */
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: rules,
    removeRuleIds: []    // none to remove now
  });

  console.log("[Blocker] redirect rules installed:", rules.length);
}
