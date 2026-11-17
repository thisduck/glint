const { BrowserWindow, globalShortcut } = require("electron");
const path = require("node:path");

async function countdown(studio, bounds) {
  const overlay = new BrowserWindow({
    ...bounds,
    type: "panel",
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    acceptFirstMouse: true,
    show: false,
    webPreferences: { sandbox: true },
  });
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  let escapeRegistered = false;
  let timer;
  try {
    await overlay.loadFile(path.join(__dirname, "countdown.html"));
    return await new Promise((resolve) => {
      let remaining = 3;
      const cancel = () => resolve(false);
      overlay.once("closed", cancel);
      overlay.webContents.on("will-navigate", (event) => {
        event.preventDefault();
        cancel();
      });
      overlay.webContents.on("before-input-event", (_, input) => {
        if (input.key === "Escape") cancel();
      });
      escapeRegistered = globalShortcut.register("Escape", cancel);
      studio.hide();
      if (escapeRegistered) overlay.showInactive();
      else overlay.show();
      timer = setInterval(() => {
        remaining--;
        if (remaining === 0) resolve(true);
        else
          overlay.webContents
            .executeJavaScript(
              "document.querySelector('strong').textContent = " + remaining,
            )
            .catch(cancel);
      }, 1000);
    });
  } finally {
    clearInterval(timer);
    if (escapeRegistered) globalShortcut.unregister("Escape");
    if (!overlay.isDestroyed()) overlay.destroy();
  }
}
module.exports = { countdown };
