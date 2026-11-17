const { Tray, Menu, globalShortcut, nativeImage } = require("electron");

function recordingMenu(onStop) {
  // A small red recording light, also visible against a dark menu bar.
  const bytes = Buffer.alloc(16 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const offset = 4 * (16 * y + x);
    bytes.set([72, 68, 232, Math.round(255 * Math.max(0, Math.min(1, 6.5 - Math.hypot(x-7.5, y-7.5))))], offset);
  }
  const tray = new Tray(nativeImage.createFromBitmap(bytes, { width: 16, height: 16 }));
  const shortcut = "CommandOrControl+Shift+9";
  let registered = false, timer;
  function close() {
    clearInterval(timer);
    if (registered) globalShortcut.unregister(shortcut);
    tray.destroy();
  }
  try {
    registered = globalShortcut.register(shortcut, onStop);
    tray.setContextMenu(Menu.buildFromTemplate([{
      label: registered ? "Stop recording (⌘⇧9)" : "Stop recording", click: onStop
    }]));
    const started = Date.now();
    function tick() {
      const seconds = Math.floor((Date.now() - started) / 1000);
      const clock = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
      if (process.platform === "darwin") tray.setTitle(clock);
      tray.setToolTip("glint · Recording " + clock);
    }
    tick();
    timer = setInterval(tick, 1000);
    return close;
  } catch (error) {
    close();
    throw error;
  }
}
module.exports = { recordingMenu };
