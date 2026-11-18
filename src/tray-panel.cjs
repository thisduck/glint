const { BrowserWindow, ipcMain, screen } = require("electron");
const path = require("node:path");

function trayPanel(tray, onAction) {
  let win, loaded = false, state, height = 460, recentlyBlurred = 0;
  function place() {
    const anchor = tray.getBounds();
    const area = screen.getDisplayMatching(anchor).workArea;
    const width = Math.min(310, area.width);
    const h = Math.min(height, area.height - 8);
    win.setBounds({
      width, height: h,
      x: Math.round(Math.max(area.x, Math.min(anchor.x + (anchor.width - width) / 2, area.x + area.width - width))),
      y: Math.round(Math.max(area.y, Math.min(anchor.y + anchor.height + 3, area.y + area.height - h))),
    });
  }
  function send() {
    if (loaded && win?.isVisible() && state) win.webContents.send("trayState", state);
  }
  function hide() { win?.hide(); }
  function toggle() {
    if (win?.isVisible()) { hide(); return; }
    // Clicking the tray icon can blur the panel just before the tray click arrives.
    if (Date.now() - recentlyBlurred < 180) return;
    if (!win) {
      win = new BrowserWindow({
        width: 310, height, show: false, frame: false, resizable: false,
        minimizable: false, maximizable: false, fullscreenable: false,
        skipTaskbar: true, alwaysOnTop: true, type: "panel",
        webPreferences: { preload: path.join(__dirname, "tray-panel-preload.cjs"), sandbox: true },
      });
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      win.setContentProtection(true);
      win.on("blur", () => {
        if (win?.isVisible()) { recentlyBlurred = Date.now(); hide(); }
      });
      win.on("closed", () => { win = null; loaded = false; });
      win.loadFile(path.join(__dirname, "tray-panel.html")).then(() => {
        loaded = true;
        send();
      }).catch(() => win?.destroy());
    }
    place();
    win.show();
    win.focus();
    send();
  }
  function fromPanel(event) {
    return win && !win.isDestroyed() && event.senderFrame === win.webContents.mainFrame;
  }
  function action(event, mode, id, value, profileId) {
    if (!fromPanel(event) || !win.isVisible()) return;
    if (id === "dismiss") hide();
    else onAction(mode, id, value, profileId);
  }
  function resize(event, next) {
    if (!fromPanel(event) || !Number.isFinite(next) || next <= 0) return;
    height = Math.max(100, Math.ceil(next));
    place();
  }
  ipcMain.on("trayAction", action);
  ipcMain.on("trayHeight", resize);
  tray.on("click", toggle);
  tray.on("right-click", toggle);
  return {
    update(next) { state = next; send(); },
    hide,
    visible: () => !!win?.isVisible(),
    destroy() {
      ipcMain.removeListener("trayAction", action);
      ipcMain.removeListener("trayHeight", resize);
      win?.destroy();
    },
  };
}
module.exports = { trayPanel };
