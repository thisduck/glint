const { BrowserWindow, ipcMain, screen } = require("electron");
const path = require("node:path");

function trayPanel(tray, onAction) {
  let win, loaded = false, state, height = 460, recentlyBlurred = 0;
  let label, hoverTimer, hovering = false;
  function hideLabel() {
    hovering = false;
    clearTimeout(hoverTimer);
    label?.hide();
  }
  function hover() {
    if (process.platform !== "darwin" || state?.mode !== "setup" || win?.isVisible()) return;
    hovering = true;
    hoverTimer = setTimeout(async () => {
      if (!label) {
        label = new BrowserWindow({
          width: 61, height: 25, frame: false, transparent: true, resizable: false,
          show: false, focusable: false, skipTaskbar: true, type: "panel",
          webPreferences: { sandbox: true },
        });
        label.setIgnoreMouseEvents(true);
        label.setAlwaysOnTop(true, "pop-up-menu");
        label.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        label.setContentProtection(true);
        try { await label.loadFile(path.join(__dirname, "tray-label.html")); }
        catch { return; }
      }
      if (!hovering || !label || label.isDestroyed()) return;
      const anchor = tray.getBounds();
      const area = screen.getDisplayMatching(anchor).workArea;
      const x = Math.max(area.x, Math.min(anchor.x + (anchor.width - 61) / 2, area.x + area.width - 61));
      label.setPosition(Math.round(x), Math.max(area.y, anchor.y + anchor.height) + 3);
      label.showInactive();
    }, 550);
  }
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
    hideLabel();
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
  tray.on("mouse-enter", hover);
  tray.on("mouse-leave", hideLabel);
  tray.on("click", toggle);
  tray.on("right-click", toggle);
  return {
    update(next) {
      if (next.mode !== state?.mode) hideLabel();
      state = next;
      send();
    },
    hide,
    visible: () => !!win?.isVisible(),
    destroy() {
      ipcMain.removeListener("trayAction", action);
      ipcMain.removeListener("trayHeight", resize);
      hideLabel();
      label?.destroy();
      win?.destroy();
    },
  };
}
module.exports = { trayPanel };
