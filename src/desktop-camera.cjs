const { BrowserWindow, screen, ipcMain } = require("electron");
const path = require("node:path");
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function desktopCamera(area, initial, place) {
  const win = new BrowserWindow({
    type: "panel",
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    acceptFirstMouse: true,
    webPreferences: {
      sandbox: true,
      preload: path.join(__dirname, "desktop-camera-preload.cjs"),
    },
  });
  let layout = initial,
    gesture,
    loaded = false;
  let shortest = Math.min(area.width, area.height),
    pad = shortest * 0.025;
  function update(point) {
    if (!point || win.isDestroyed()) return;
    layout = point;
    const size = Math.max(1, Math.round(shortest * (point.scale ?? 0.23)));
    win.setBounds({
      width: size,
      height: size,
      x: Math.round(area.x + pad + (area.width - 2 * pad - size) * point.x),
      y: Math.round(area.y + pad + (area.height - 2 * pad - size) * point.y),
    });
  }
  function drag(event, action) {
    if (win.isDestroyed() || event.senderFrame !== win.webContents.mainFrame)
      return;
    const cursor = screen.getCursorScreenPoint();
    if (action === "move" || action === "resize") {
      gesture = { cursor, bounds: win.getBounds(), action };
    } else if (action === "end") {
      gesture = null;
    } else if (action === "drag" && gesture) {
      const dx = cursor.x - gesture.cursor.x,
        dy = cursor.y - gesture.cursor.y;
      const b = gesture.bounds,
        resize = gesture.action === "resize";
      const scale = resize
        ? clamp((b.width + (dx + dy) / 2) / shortest, 0.1, 0.48)
        : (layout.scale ?? 0.23);
      const size = shortest * scale;
      place({
        scale,
        x: clamp(
          (b.x + (resize ? 0 : dx) - area.x - pad) /
            (area.width - 2 * pad - size),
          0,
          1,
        ),
        y: clamp(
          (b.y + (resize ? 0 : dy) - area.y - pad) /
            (area.height - 2 * pad - size),
          0,
          1,
        ),
      });
    }
  }
  ipcMain.on("desktopCameraDrag", drag);
  win.once("closed", () => ipcMain.removeListener("desktopCameraDrag", drag));
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setContentProtection(true);
  update(initial);
  win
    .loadFile(path.join(__dirname, "desktop-camera.html"))
    .then(() => {
      loaded = true;
    })
    .catch(() => {
      if (!win.isDestroyed()) win.destroy();
    });
  return {
    update,
    setArea(next) {
      area = next;
      shortest = Math.min(area.width, area.height);
      pad = shortest * 0.025;
      update(layout);
    },
    portrait(frame) {
      if (loaded && !win.isDestroyed()) {
        win.webContents.send("portrait", frame);
        if (!win.isVisible()) win.showInactive();
      }
    },
    close() {
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
module.exports = { desktopCamera };
