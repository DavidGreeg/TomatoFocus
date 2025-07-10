// helper – play one MP3 and resolve when it ends
function playOne(name) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(chrome.runtime.getURL(`sounds/${name}.mp3`));
    audio.addEventListener("ended", resolve,  { once: true });
    audio.addEventListener("error", () => reject(new Error(`Failed to play ${name}`)), { once: true });
    audio.play().catch(reject);
  });
}

chrome.runtime.onMessage.addListener(async (msg, _sender, reply) => {
  // single sound (old behaviour)
  if (msg.cmd === "playSound") {
    try {
      await playOne(msg.sound);
      reply?.({ ok: true });
    } catch (err) {
      console.error(err);
      reply?.({ ok: false, error: err.message });
    }
    return true;                     // keep port open
  }

  // NEW: sequential sounds
  if (msg.cmd === "playSoundSeq") {
    try {
      for (const s of msg.sounds) await playOne(s);
      reply?.({ ok: true });
    } catch (err) {
      console.error(err);
      reply?.({ ok: false, error: err.message });
    }
    return true;
  }
});
