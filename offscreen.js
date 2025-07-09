// Plays a sound bundled in /sounds via the Offscreen Documents API.
// Provides clearer errors and a user‑gesture fallback.

chrome.runtime.onMessage.addListener(async (msg, _sender, reply) => {
  if (msg.cmd !== "playSound") return; // ignore others

  const url = chrome.runtime.getURL(`sounds/${msg.sound}.mp3`);
  const audio = new Audio(url);
  audio.preload = "auto";

  function respond(ok, error = "") {
    try { reply?.({ ok, error }); } catch (_) { /* port closed */ }
  }

  // Decode / network errors
  audio.addEventListener("error", () => {
    const code = audio.error?.code ?? 0; // 1=MEDIA_ERR_ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED
    respond(false, `HTMLMediaElement error code ${code}`);
  }, { once: true });

  // Autoplay / permission errors → ask SW to retry from an interactive page
  try {
    await audio.play();
    respond(true);
  } catch (err) {
    if (err.name === "NotAllowedError") {
      // Likely blocked by autoplay policy — let the popup handle playback instead.
      chrome.runtime.sendMessage({ cmd: "playSoundPopup", sound: msg.sound });
    }
    respond(false, err.name + ": " + err.message);
  }

  return true; // keep port alive
});
