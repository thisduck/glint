const { BrowserWindow } = require("electron");

async function captureOutline(bounds) {
  const win = new BrowserWindow({
    ...bounds,
    type: "panel",
    frame: false,
    transparent: true,
    hasShadow: false,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    show: false,
    enableLargerThanScreen: true,
    webPreferences: { sandbox: true },
  });
  try {
    win.setIgnoreMouseEvents(true);
    win.setContentProtection(true);
    win.setAlwaysOnTop(true, "floating");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    await win.loadURL(
      "data:text/html," +
        encodeURIComponent(
          "<meta charset=utf-8><style>html{height:100%;box-sizing:border-box;border:3px solid #748bff;border-radius:5px}body{margin:0}</style>",
        ),
    );
    win.showInactive();
    return win;
  } catch (error) {
    if (!win.isDestroyed()) win.destroy();
    throw error;
  }
}
module.exports = { captureOutline };
