const { BrowserWindow, ipcMain, screen } = require("electron");
const path = require("node:path");

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function recordingToolbar(commands) {
  const preview = commands.phase === "preview";
  let target = commands.captureArea;
  const display = target
    ? screen.getDisplayMatching(target)
    : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const area = display.workArea;
  const width = Math.min(area.width, preview ? 508 : 420);
  let height = preview ? 112 : commands.position ? 168 : 83;
  function origin(capture) {
    const workArea = screen.getDisplayMatching(capture).workArea;
    const inset = 16;
    const centerX = capture.x + (capture.width - width) / 2;
    return {
      x: Math.round(clamp(centerX, workArea.x, workArea.x + workArea.width - width)),
      y: Math.round(
        clamp(
          capture.y + inset,
          workArea.y,
          workArea.y + workArea.height - height,
        ),
      ),
    };
  }
  const win = new BrowserWindow({
    ...(preview && target
      ? origin(target)
      : { x: area.x + 18, y: area.y + area.height - height - 18 }),
    width,
    height,
    type: "panel",
    frame: false,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    acceptFirstMouse: true,
    backgroundColor: "#24222d",
    webPreferences: {
      preload: path.join(__dirname, "toolbar-preload.cjs"),
      sandbox: true,
    },
  });
  const portraitOptions = commands.portraitOptions;
  let bubble;
  let layout = commands.initialPosition;
  function showCamera() {
    if (!portraitOptions || !layout || bubble) return;
    bubble = require("./desktop-camera.cjs").desktopCamera(
      portraitOptions.area || area,
      layout,
      commands.position,
    );
  }
  if (!preview && portraitOptions?.desktop) showCamera();
  const portraitTimer =
    portraitOptions &&
    setInterval(() => {
      if (bubble || (!preview && !win.isDestroyed() && win.isVisible()))
        portraitOptions.request();
    }, 125);
  let state = {
    phase: commands.phase,
    clock: "0:00",
    paused: false,
    position: !preview && commands.position ? layout : null,
  };
  let visible = false;
  let loaded = false;
  const receive = (event, action, point) => {
    if (win.isDestroyed() || event.senderFrame !== win.webContents.mainFrame)
      return;
    if (
      action === "position" &&
      state.position &&
      commands.position &&
      [point?.x, point?.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
    )
      commands.position({ x: point.x, y: point.y });
    if (
      action === "scale" &&
      state.position &&
      commands.position &&
      Number.isFinite(point) &&
      point >= 0.1 &&
      point <= 0.48
    )
      commands.position({ scale: point });
    if (preview) {
      if (action === "cancel") commands.cancel?.();
      if (!state.busy) {
        if (action === "start") commands.start?.();
        if (action === "toggleCamera") commands.toggleCamera?.();
        if (action === "toggleMic") commands.toggleMic?.();
      }
    } else if (action === "hide") {
      visible = false;
      win.hide();
    } else if (action === "stop" || action === "toggle") {
      commands[action]();
    }
  };
  ipcMain.on("toolbarCommand", receive);
  win.once("closed", () => ipcMain.removeListener("toolbarCommand", receive));
  win.setAlwaysOnTop(true, "screen-saver");
  win.setContentProtection(true);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  const ready = win.loadFile(path.join(__dirname, "toolbar.html")).then(() => {
    if (win.isDestroyed()) return;
    loaded = true;
    win.webContents.send("toolbarState", state);
    if (visible) win.showInactive();
  });
  ready.catch(() => {
    if (!win.isDestroyed()) win.destroy();
  });

  return {
    ready,
    setArea(next) {
      if (preview && !win.isDestroyed() && target) {
        const oldOrigin = origin(target);
        const nextOrigin = origin(next);
        const point = win.getBounds();
        const workArea = screen.getDisplayMatching(next).workArea;
        win.setPosition(
          clamp(point.x + nextOrigin.x - oldOrigin.x, workArea.x, workArea.x + workArea.width - width),
          clamp(point.y + nextOrigin.y - oldOrigin.y, workArea.y, workArea.y + workArea.height - height),
        );
      }
      target = next;
      if (portraitOptions) portraitOptions.area = next;
      bubble?.setArea(next);
    },
    showCamera,
    show() {
      visible = true;
      if (loaded && !win.isDestroyed()) win.showInactive();
    },
    portrait(frame) {
      bubble?.portrait(frame);
      if (!win.isDestroyed() && win.isVisible())
        win.webContents.send("portrait", frame);
    },
    update(next) {
      if (next.position) layout = next.position;
      if (preview && !next.cameraOn && bubble) {
        bubble.close();
        bubble = null;
      }
      if (preview && next.cameraOn && portraitOptions?.desktop) showCamera();
      if (preview && !win.isDestroyed()) {
        const newHeight = next.position ? 188 : 112;
        if (height !== newHeight) {
          const bounds = win.getBounds();
          const workArea = screen.getDisplayMatching(target ?? bounds).workArea;
          win.setBounds({
            ...bounds,
            y: clamp(bounds.y, workArea.y, workArea.y + workArea.height - newHeight),
            height: newHeight,
          });
          height = newHeight;
        }
      }
      bubble?.update(layout);
      state = next;
      if (loaded && !win.isDestroyed()) win.webContents.send("toolbarState", next);
    },
    close() {
      clearInterval(portraitTimer);
      bubble?.close();
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
module.exports = { recordingToolbar };
