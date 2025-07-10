const $ = id => document.getElementById(id);
const timerEl = $("timer"), modeEl = $("mode"), startBtn = $("startPause");
const longBreakToggle = $("enableLongBreak"), longBreakSettings = $("longBreakSettings");

function updateLongBreakUI() {
  longBreakSettings.style.display = longBreakToggle.checked ? "" : "none";
}
if (longBreakToggle) {
  longBreakToggle.addEventListener("change", updateLongBreakUI);
  updateLongBreakUI();
}

/************ live updates ************/
chrome.runtime.sendMessage({cmd:"getState"}, refresh);
chrome.runtime.onMessage.addListener(msg=>{
  if(msg.cmd==="tick")   refresh(msg.state);
  if(msg.cmd==="playSoundPopup") playLocal(msg.sound); // fallback audio
});

/************ controls ************/
startBtn.addEventListener("click", ()=> chrome.runtime.sendMessage({cmd:"toggle"}));
$("reset").addEventListener("click", ()=> chrome.runtime.sendMessage({cmd:"reset"}));

/************ settings load ************/
chrome.storage.local.get(["settings"], ({settings})=>{
  if(settings){
    $("workMinutes").value=settings.work;
    $("breakMinutes").value=settings.break;
    $("cycles").value=settings.cycles;
    $("longBreak").value=settings.longBreak ?? 15;
    $("longBreakEvery").value=settings.longBreakEvery ?? 4;
  }
});

/************ save settings ************/
$("saveSettings").addEventListener("click", ()=>{
  const settings={
    work:+$("workMinutes").value,
    break:+$("breakMinutes").value,
    cycles:+$("cycles").value,
    longBreak:+$("longBreak").value,
    longBreakEvery:+$("longBreakEvery").value
  };
  chrome.storage.local.set({settings}, ()=>{
    chrome.runtime.sendMessage({cmd:"settingsUpdated"});
    alert("Saved! New values apply on next reset/start.");
  });
});

/************ test sound ************/
$("testSound").addEventListener("click", ()=> playLocal("work"));

function playLocal(sound){
  new Audio(chrome.runtime.getURL(`sounds/${sound}.mp3`)).play().catch(console.warn);
}

function refresh(s){
  const m=String(s.minutes).padStart(2,"0"), sec=String(s.seconds).padStart(2,"0");
  timerEl.textContent=`${m}:${sec}`;
  const label=s.mode==="longBreak"?"Long Break":s.mode.charAt(0).toUpperCase()+s.mode.slice(1);
  modeEl.textContent=`${label} (${s.cycle+1}/${s.totalCycles})`;
  startBtn.textContent=s.running ? "Pause" : (s.paused ?  "Resume" : "Start"); // Change time tracking display
}
