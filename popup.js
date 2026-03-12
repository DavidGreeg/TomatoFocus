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
  const navWebsiteBlock = $('nav-website-block');
  const websiteBlockList = $('website-block-list');
  const navSitesList = $('nav-sites-list');
  const navTimeSchedule = $('nav-time-schedule');
  const navHabitTracker = $('nav-habit-tracker');

  const pomodoroView = $('pomodoro-view');
  const sitesListView = $('sites-list-view');
  const views = [pomodoroView, sitesListView];

  function setListButtonExpanded(button, isExpanded) {
    button.classList.toggle('expanded', isExpanded);
    button.setAttribute('aria-expanded', String(isExpanded));
  }

  function toggleWebsiteBlockList(forceExpanded) {
    const shouldExpand = typeof forceExpanded === 'boolean'
      ? forceExpanded
      : websiteBlockList.classList.contains('hidden');

    websiteBlockList.classList.toggle('hidden', !shouldExpand);
    setListButtonExpanded(navWebsiteBlock, shouldExpand);
  }

  function setWebsiteSubnavActive(activeButton) {
    [navSitesList, navTimeSchedule].forEach(button => {
      button.classList.toggle('active', button === activeButton);
    });
    const hasActiveSubnav = [navSitesList, navTimeSchedule].some(button => button.classList.contains('active'));
    navWebsiteBlock.disabled = hasActiveSubnav;
    navWebsiteBlock.classList.toggle('locked', hasActiveSubnav);
    navWebsiteBlock.setAttribute('aria-disabled', String(hasActiveSubnav));
  }

  function showView(viewToShow) {
    views.forEach(view => {
      view.classList.add('hidden');
    });
    viewToShow.classList.remove('hidden');

    navPomodoro.classList.toggle('active', viewToShow === pomodoroView);
    navSitesList.classList.toggle('active', viewToShow === sitesListView);
  }

  navPomodoro.addEventListener('click', () => {
    showView(pomodoroView);
    setWebsiteSubnavActive(null);
    toggleWebsiteBlockList(false);
  });
  navWebsiteBlock.addEventListener('click', () => {
    if (navWebsiteBlock.disabled) return;
    toggleWebsiteBlockList();
  });

  navSitesList.addEventListener('click', () => {
    toggleWebsiteBlockList(true);
    showView(sitesListView);
    setWebsiteSubnavActive(navSitesList);
  });

  navTimeSchedule.addEventListener('click', () => {
    setWebsiteSubnavActive(navTimeSchedule);
    // showView(timeScheduleView);
  });

  navHabitTracker.addEventListener('click', () => {
    setWebsiteSubnavActive(null);
    toggleWebsiteBlockList(false);
    // showView(habitTrackerView);
  });

  // Show Pomodoro view by default
  showView(pomodoroView);
  setWebsiteSubnavActive(null);
  toggleWebsiteBlockList(false);


  // --- Pomodoro Logic (largely unchanged) ---
  const timerEl = $('timer'), modeEl = $('mode'), startBtn = $('startPause');
  const longBreakToggle = $('enableLongBreak'), longBreakSettings = $('longBreakSettings');
  const settingsDetails = document.querySelector('.settings-details');

  function updateLongBreakUI() {
    const on = longBreakToggle.checked;
    longBreakSettings.style.display = on ? '' : 'none';
    longBreakSettings.querySelectorAll('input').forEach(el => (el.disabled = !on));
  }
  longBreakToggle.addEventListener('change', updateLongBreakUI);

  // Live updates from service worker
  chrome.runtime.sendMessage({ cmd: 'getState' }, refresh);
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.cmd === 'tick') refresh(msg.state);
    if (msg.cmd === 'playSoundPopup') playLocal(msg.sound);
  });

  // Controls
  startBtn.addEventListener('click', () => chrome.runtime.sendMessage({ cmd: 'toggle' }));
  $('reset').addEventListener('click', () => chrome.runtime.sendMessage({ cmd: 'reset' }));

  // Settings Load
  chrome.storage.local.get(['settings'], ({ settings }) => {
    if (settings) {
      $('workMinutes').value = settings.work;
      $('breakMinutes').value = settings.break;
      $('cycles').value = settings.cycles;
      longBreakToggle.checked = settings.enableLongBreak ?? false;
      $('longBreak').value = settings.longBreak ?? 15;
      $('longBreakEvery').value = settings.longBreakEvery ?? 4;
    } else {
      longBreakToggle.checked = false;
    }
    updateLongBreakUI();
  });

  // Save Settings
  $('saveSettings').addEventListener('click', () => {
    const settings = {
      work: +$('workMinutes').value,
      break: +$('breakMinutes').value,
      cycles: +$('cycles').value,
      enableLongBreak: longBreakToggle.checked,
      longBreak: +$('longBreak').value,
      longBreakEvery: +$('longBreakEvery').value
    };
    chrome.storage.local.set({ settings }, () => {
      chrome.runtime.sendMessage({ cmd: 'settingsUpdated' });
      if (settingsDetails) settingsDetails.open = false;
    });
  });

  // Intended for future usage when the control is visible again.
  $('testSound').addEventListener('click', () => playLocal('work'));
  function playLocal(sound) {
    new Audio(chrome.runtime.getURL(`sounds/${sound}.mp3`)).play().catch(console.warn);
  }

  // Refresh UI
  function refresh(s) {
    if (!s) return;
    const m = String(s.minutes).padStart(2, '0'), sec = String(s.seconds).padStart(2, '0');
    timerEl.textContent = `${m}:${sec}`;
    const label = s.mode === 'longBreak' ? 'Long Break' : s.mode.charAt(0).toUpperCase() + s.mode.slice(1);
    modeEl.textContent = `${label} (${s.cycle + 1}/${s.totalCycles})`;
    startBtn.textContent = s.running ? 'Pause' : (s.paused ? 'Resume' : 'Start');
  }


  // --- Website Blocker Logic ---
  const newSiteInput = $('new-site-input');
  const addSiteButton = $('add-site-button');
  const inputModeToggle = $('input-mode-toggle');
  let regexMode = false;
  inputModeToggle.dataset.tip = 'web\ndomain';
  inputModeToggle.classList.add('narrow-font');

  const note = document.querySelector('.blocker-note');
  const dismissBtn = document.getElementById('dismiss-note');

  async function setupBlockerNote() {
    if (!note) return;

    const { blockerNoteShownThisSession = false } = await chrome.storage.session.get('blockerNoteShownThisSession');
    if (blockerNoteShownThisSession) {
      note.remove();
      return;
    }

    await chrome.storage.session.set({ blockerNoteShownThisSession: true });
    dismissBtn?.addEventListener('click', () => note.remove());
  }

  setupBlockerNote();

  inputModeToggle.addEventListener('click', () => {
    regexMode = !regexMode;
    inputModeToggle.textContent = regexMode ? '(.*)' : 'WWW';
    inputModeToggle.dataset.tip = regexMode ? 'regular\nexpression' : 'web\ndomain';
    inputModeToggle.classList.toggle('narrow-font', !regexMode);
  });
  const blockedSitesList = $('blocked-sites-list');

  async function renderBlockedSites() {
    const data = await chrome.storage.local.get(['userBlockedSites', 'defaultSites']);
    let userBlockedSites = Array.isArray(data.userBlockedSites) ? data.userBlockedSites : [];
    let storedDefaults = Array.isArray(data.defaultSites) ? data.defaultSites : defaultSites;

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
      const actions = document.createElement('div');
      actions.className = 'flex items-center space-x-1';
      if (typeof site !== 'string') {
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = 'regex';
        toggleBtn.className = 'toggle-regex-button';
        toggleBtn.addEventListener('click', () => {
          const showingName = siteName.textContent === site.name;
          siteName.textContent = showingName ? site.regex : site.name;
          siteName.classList.toggle('regex-text', showingName);
          siteName.classList.toggle('slim-scrollbar', showingName);
          listItem.classList.toggle('blocked-regex-item', showingName);
          toggleBtn.textContent = showingName ? 'name' : 'regex';
        });
        actions.appendChild(toggleBtn);
      }
      actions.appendChild(removeButton);
      listItem.appendChild(actions);
      blockedSitesList.appendChild(listItem);
    });
  }

  addSiteButton.addEventListener('click', async () => {
    const newSite = newSiteInput.value.trim();
    if (!newSite) return;

    const { userBlockedSites = [] } = await chrome.storage.local.get('userBlockedSites');

    let newEntry;
    if (regexMode) {
      newEntry = { name: newSite, regex: newSite };
    } else {
      let domain = newSite;
      try {
        domain = new URL(newSite).hostname;
      } catch (_) {
        domain = newSite.replace(/^www\./, '');
      }
      newEntry = domain;
    }

    const exists = userBlockedSites.some(s => JSON.stringify(s) === JSON.stringify(newEntry));
    if (!exists) {
      const newBlockedSites = [...userBlockedSites, newEntry];
      await chrome.storage.local.set({ userBlockedSites: newBlockedSites });
      newSiteInput.value = '';
      renderBlockedSites();
    }
  });

  // Initial render when popup is opened
  renderBlockedSites();
});
