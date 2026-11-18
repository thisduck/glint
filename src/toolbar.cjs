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
  const width = Math.min(area.width, preview ? 360 : 240);
  let height = 52;
  let cameraTools = false;
  function clampBounds(b, h) {
    const wa = screen.getDisplayMatching({ ...b, width, height: h }).workArea;
    return {
      x: Math.round(clamp(b.x, wa.x, wa.x + wa.width - width)),
      y: Math.round(clamp(b.y, wa.y, wa.y + wa.height - h)),
      width,
      height: h,
    };
  }
  function origin(capture) {
    const workArea = screen.getDisplayMatching(capture).workArea;
    const inset = 16;
    const centerX = capture.x + (capture.width - width) / 2;
    return {
      x: Math.round(
        clamp(centerX, workArea.x, workArea.x + workArea.width - width),
      ),
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
    ...(commands.initialBounds
      ? clampBounds(commands.initialBounds, height)
      : target
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
    cameraTools,
  };
  function resize() {
    const next = state.position && cameraTools ? 136 : 52;
    if (win.isDestroyed() || next === height) return;
    height = next;
    win.setBounds(clampBounds(win.getBounds(), height));
  }
  let visible = false;
  let loaded = false;
  const receive = (event, action, point) => {
    if (win.isDestroyed() || event.senderFrame !== win.webContents.mainFrame)
      return;
    if (action === "cameraTools" && typeof point === "boolean") {
      cameraTools = !!state.position && point;
      state = { ...state, cameraTools };
      resize();
      if (loaded) win.webContents.send("toolbarState", state);
      return;
    }
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
    clearInterval(portraitTimer);
    bubble?.close();
    bubble = null;
    if (!win.isDestroyed()) win.destroy();
  });

  return {
    ready,
    getBounds: () => (win.isDestroyed() ? null : win.getBounds()),
    setArea(next) {
      if (!win.isDestroyed() && target) {
        const oldOrigin = origin(target);
        const nextOrigin = origin(next);
        const point = win.getBounds();
        win.setBounds(
          clampBounds(
            {
              x: point.x + nextOrigin.x - oldOrigin.x,
              y: point.y + nextOrigin.y - oldOrigin.y,
            },
            height,
          ),
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
      if (!next.position) cameraTools = false;
      state = { phase: commands.phase, ...next, cameraTools };
      resize();
      bubble?.update(layout);
      if (loaded && !win.isDestroyed())
        win.webContents.send("toolbarState", state);
    },
    close() {
      clearInterval(portraitTimer);
      bubble?.close();
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
module.exports = { recordingToolbar };
