document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  const defaultSites = [
    'twitter.com',
    'instagram.com',
    'youtube.com',
    'duolingo.com',
    'deeeep.io',
    'diep.io',
    'deepl.com',
    { name: 'diep games', regex: '^https?:\\/\\/([a-z0-9-]+\\.)*diep\\.io($|/)' },
    { name: 'zombs games', regex: '^https?:\\/\\/([a-z0-9-]+\\.)*zomb[^./]*\\.io($|/)' },
    'slither.io',
    'agar.io',
    'colonist.io',
    'nitrotype.com',
    'wco.tv',
    'catflix.su'
  ];

  chrome.storage.local.get(['defaultSites'], ({ defaultSites: stored }) => {
    if (!Array.isArray(stored)) {
      chrome.storage.local.set({ defaultSites });
    }
  });

  // --- Tab Navigation ---
  const navPomodoro = $('nav-pomodoro');
  const navBlocker = $('nav-blocker');
  const pomodoroView = $('pomodoro-view');
  const blockerView = $('blocker-view');
  const views = [pomodoroView, blockerView];

  function showView(viewToShow) {
    views.forEach(view => {
      view.classList.add('hidden');
    });
    viewToShow.classList.remove('hidden');
    
    navPomodoro.classList.toggle('active', viewToShow === pomodoroView);
    navBlocker.classList.toggle('active', viewToShow === blockerView);
  }

  navPomodoro.addEventListener('click', () => showView(pomodoroView));
  navBlocker.addEventListener('click', () => showView(blockerView));
  
  // Show Pomodoro view by default
  showView(pomodoroView);


  // --- Pomodoro Logic (largely unchanged) ---
  const timerEl = $("timer"), modeEl = $("mode"), startBtn = $("startPause");
  const longBreakToggle = $("enableLongBreak"), longBreakSettings = $("longBreakSettings");

  function updateLongBreakUI() {
    const on = longBreakToggle.checked;
    longBreakSettings.style.display = on ? "" : "none";
    longBreakSettings.querySelectorAll("input").forEach(el => (el.disabled = !on));
  }
  longBreakToggle.addEventListener("change", updateLongBreakUI);

  // Live updates from service worker
  chrome.runtime.sendMessage({ cmd: "getState" }, refresh);
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.cmd === "tick") refresh(msg.state);
    if (msg.cmd === "playSoundPopup") playLocal(msg.sound);
  });

  // Controls
  startBtn.addEventListener("click", () => chrome.runtime.sendMessage({ cmd: "toggle" }));
  $("reset").addEventListener("click", () => chrome.runtime.sendMessage({ cmd: "reset" }));

  // Settings Load
  chrome.storage.local.get(["settings"], ({ settings }) => {
    if (settings) {
      $("workMinutes").value = settings.work;
      $("breakMinutes").value = settings.break;
      $("cycles").value = settings.cycles;
      longBreakToggle.checked = settings.enableLongBreak ?? false;
      $("longBreak").value = settings.longBreak ?? 15;
      $("longBreakEvery").value = settings.longBreakEvery ?? 4;
    } else {
      longBreakToggle.checked = false;
    }
    updateLongBreakUI();
  });

  // Save Settings
  $("saveSettings").addEventListener("click", () => {
    const settings = {
      work: +$("workMinutes").value,
      break: +$("breakMinutes").value,
      cycles: +$("cycles").value,
      enableLongBreak: longBreakToggle.checked,
      longBreak: +$("longBreak").value,
      longBreakEvery: +$("longBreakEvery").value
    };
    chrome.storage.local.set({ settings }, () => {
      chrome.runtime.sendMessage({ cmd: "settingsUpdated" });
      alert("Saved! New values apply on next reset/start.");
    });
  });

  // Test Sound
  $("testSound").addEventListener("click", () => playLocal("work"));
  function playLocal(sound) {
    new Audio(chrome.runtime.getURL(`sounds/${sound}.mp3`)).play().catch(console.warn);
  }

  // Refresh UI
  function refresh(s) {
    if (!s) return;
    const m = String(s.minutes).padStart(2, "0"), sec = String(s.seconds).padStart(2, "0");
    timerEl.textContent = `${m}:${sec}`;
    const label = s.mode === "longBreak" ? "Long Break" : s.mode.charAt(0).toUpperCase() + s.mode.slice(1);
    modeEl.textContent = `${label} (${s.cycle + 1}/${s.totalCycles})`;
    startBtn.textContent = s.running ? "Pause" : (s.paused ? "Resume" : "Start");
  }


  // --- Website Blocker Logic ---
  const newSiteInput = $('new-site-input');
  const addSiteButton = $('add-site-button');
  const blockedSitesList = $('blocked-sites-list');

  async function renderBlockedSites() {
    const data = await chrome.storage.local.get(['userBlockedSites', 'defaultSites']);
    let userBlockedSites = Array.isArray(data.userBlockedSites) ? data.userBlockedSites : [];
    let storedDefaults   = Array.isArray(data.defaultSites) ? data.defaultSites : defaultSites;

    if (!data.defaultSites) {
      await chrome.storage.local.set({ defaultSites: storedDefaults });
    }

    if (!Array.isArray(data.userBlockedSites)) {
      await chrome.storage.local.set({ userBlockedSites });
    }

    const allSites = [
      ...storedDefaults.map((site, index) => ({ site, type: 'default', index })),
      ...userBlockedSites.map((site, index) => ({ site, type: 'user', index }))
    ];

    blockedSitesList.innerHTML = '';

    if (allSites.length === 0) {
      blockedSitesList.innerHTML = `<p class="text-slate-500 text-center">No websites added yet.</p>`;
    }

    allSites.forEach(({ site, type, index }) => {
      const listItem = document.createElement('li');
      listItem.className = 'blocked-site-item flex items-center space-x-1';

      const siteName = document.createElement('span');
      siteName.className = 'text-sm';
      if (typeof site === 'string') {
        siteName.textContent = site;
      } else {
        siteName.textContent = site.name;
        siteName.dataset.regex = site.regex;
      }

      const removeButton = document.createElement('button');
      removeButton.textContent = '✖';
      removeButton.className = 'remove-site-button';
      removeButton.dataset.type = type;
      removeButton.dataset.index = index;

      removeButton.addEventListener('click', async () => {
        const { userBlockedSites = [], defaultSites = [] } = await chrome.storage.local.get(['userBlockedSites', 'defaultSites']);
        if (removeButton.dataset.type === 'user') {
          userBlockedSites.splice(index, 1);
          await chrome.storage.local.set({ userBlockedSites });
        } else {
          defaultSites.splice(index, 1);
          await chrome.storage.local.set({ defaultSites });
        }
        renderBlockedSites();
      });

      listItem.appendChild(siteName);
      if (typeof site !== 'string') {
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = 'regex';
        toggleBtn.className = 'toggle-regex-button';
        toggleBtn.addEventListener('click', () => {
          if (siteName.textContent === site.name) {
            siteName.textContent = site.regex;
            siteName.classList.add('regex-text');
            toggleBtn.textContent = 'name';
          } else {
            siteName.textContent = site.name;
            siteName.classList.remove('regex-text');
            toggleBtn.textContent = 'regex';
          }
        });
        listItem.appendChild(toggleBtn);
      }
      listItem.appendChild(removeButton);
      blockedSitesList.appendChild(listItem);
    });
  }

  addSiteButton.addEventListener('click', async () => {
    const newSite = newSiteInput.value.trim();
    if (!newSite) return;

    // Basic validation to extract domain
    let domain = newSite;
    try {
      domain = new URL(newSite).hostname;
    } catch (_) {
      // It's not a full URL, assume it's a domain
      domain = newSite.replace(/^www\./, '');
    }
    
    const { userBlockedSites = [] } = await chrome.storage.local.get("userBlockedSites");
    if (!userBlockedSites.includes(domain)) {
      const newBlockedSites = [...userBlockedSites, domain];
      await chrome.storage.local.set({ userBlockedSites: newBlockedSites });
      newSiteInput.value = '';
      renderBlockedSites();
    }
  });

  // Initial render when popup is opened
  renderBlockedSites();
});
