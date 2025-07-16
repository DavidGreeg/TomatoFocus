document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

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
    const { userBlockedSites = [] } = await chrome.storage.local.get("userBlockedSites");
    blockedSitesList.innerHTML = '';
    
    if (userBlockedSites.length === 0) {
      blockedSitesList.innerHTML = `<p class="text-slate-500 text-center">No websites added yet.</p>`;
    }

    userBlockedSites.forEach(site => {
      const listItem = document.createElement('li');
      listItem.className = 'blocked-site-item';
      
      const siteName = document.createElement('span');
      siteName.textContent = site;
      siteName.className = 'font-mono text-sm';
      
      const removeButton = document.createElement('button');
      removeButton.textContent = '✖';
      removeButton.className = 'remove-site-button';
      removeButton.dataset.site = site;
      
      removeButton.addEventListener('click', async () => {
        const siteToRemove = removeButton.dataset.site;
        const { userBlockedSites = [] } = await chrome.storage.local.get("userBlockedSites");
        const newBlockedSites = userBlockedSites.filter(s => s !== siteToRemove);
        await chrome.storage.local.set({ userBlockedSites: newBlockedSites });
        // No need to call render again, storage listener in service_worker handles rules.
        // We just re-render the popup list.
        renderBlockedSites(); 
      });

      listItem.appendChild(siteName);
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
