const { BrowserWindow, ipcMain, screen } = require("electron");
const path = require("node:path");

function recordingToolbar(commands) {
  const target = commands.captureArea;
  const display = target ? screen.getDisplayMatching(target) : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const area=display.workArea;
  const win = new BrowserWindow({
    x: area.x + 18,
    y: area.y + area.height - 84,
    width: commands.position ? 540 : 360,
    height: 60,
    type:"panel",
    frame: false,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    acceptFirstMouse: true,
    backgroundColor: "#1b2236",
    webPreferences: {
      preload: path.join(__dirname, "toolbar-preload.cjs"),
      sandbox: true,
    },
  });
  const portraitOptions=commands.portraitOptions;
  let bubble,layout=commands.initialPosition;
  function showCamera(){
    if(!portraitOptions)return;
    if(!bubble)bubble=require("./desktop-camera.cjs").desktopCamera(portraitOptions.area || area,layout,commands.position);
  }
  if(portraitOptions?.desktop)showCamera();
  const portraitTimer=portraitOptions && setInterval(()=>{
    if(bubble || (!win.isDestroyed() && win.isVisible()))portraitOptions.request();
  },125);
  let state = { clock: "0:00", paused: false };
  const receive = (event, action, point) => {
    if (win.isDestroyed() || event.senderFrame !== win.webContents.mainFrame)
      return;
    if (
      action === "position" &&
      commands.position &&
      [point?.x, point?.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
    )
      commands.position(point);
    if(action==="scale" && commands.position && Number.isFinite(point) && point>=0.1 && point<=0.48)commands.position({scale:point});
    if (action === "hide") win.hide();
    else if (action === "stop" || action === "toggle") commands[action]();
  };
  ipcMain.on("toolbarCommand", receive);
  win.once("closed", () => ipcMain.removeListener("toolbarCommand", receive));
  win.setAlwaysOnTop(true,"screen-saver");
  win.setContentProtection(true);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  let visible = false;
  win
    .loadFile(path.join(__dirname, "toolbar.html"))
    .then(() => {
      if (!win.isDestroyed()) {
        win.webContents.send("toolbarState", state);
        if (visible) win.showInactive();
      }
    })
    .catch(() => {
      if (!win.isDestroyed()) win.destroy();
    });
  return {
    setArea(next){if(portraitOptions)portraitOptions.area=next;bubble?.setArea(next);},
    showCamera,
    show() {
      visible = true;
      if (!win.isDestroyed() && !win.webContents.isLoading())
        win.showInactive();
    },
    portrait(frame){bubble?.portrait(frame);if(!win.isDestroyed() && win.isVisible())win.webContents.send("portrait",frame);},
    update(next) {
      layout=next.position;
      bubble?.update(layout);
      state = next;
      if (!win.isDestroyed()) win.webContents.send("toolbarState", next);
    },
    close() {
      clearInterval(portraitTimer);bubble?.close();
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
module.exports = { recordingToolbar };
