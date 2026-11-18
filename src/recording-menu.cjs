const { Tray, globalShortcut, nativeImage } = require("electron");

function studioMenu(onNew, onOpen, onQuit, onSetting) {
  const icon = nativeImage.createFromPath(require("node:path").join(__dirname, "../build/trayTemplate.png"));
  icon.setTemplateImage(true);
  const tray = new Tray(icon);
  let settings;
  let recording = false;
  let mode, rows, activeProfile;
  const panel = require("./tray-panel.cjs").trayPanel(tray, (requestedMode, id, raw, profileId) => {
    if (requestedMode !== mode || profileId !== activeProfile) return;
    const row = rows.find((item) => item.id === id);
    if (!row || row.disabled) return;
    if (row.kind === "select") {
      const option = row.options.find(([value]) => String(value) === raw);
      if (option) row.apply(option[0]);
    } else if (row.kind === "switch") {
      if (typeof raw === "boolean") row.apply(raw);
    } else {
      if (row.dismiss) panel.hide();
      row.apply();
    }
  });
  function display(nextMode, nextRows, clock) {
    mode = nextMode;
    rows = nextRows;
    activeProfile = mode === "setup" ? settings?.profileId : undefined;
    panel.update({ mode, clock, profileId: activeProfile, rows: rows.map(({apply, dismiss, options, ...row}) => ({
      ...row, value: row.kind === "select" ? String(row.value) : row.value,
      options: options?.map(([value, label]) => ({ value: String(value), label })),
    })) });
  }
  function rebuild() {
    if (recording) return;
    const items = [
      { id: "new", label: settings?.previewing ? "Start recording" : "New recording…",
        kind: "button", primary: true, disabled: !settings || settings.locked, dismiss: true, apply: onNew },
    ];
    if (settings) {
      const { profileId, locked: disabled } = settings;
      function setting(id, label, options) {
        return { id, label, options, disabled, value: settings[id],
          kind: options ? "select" : "switch", apply: (value) => onSetting(profileId, id, value) };
      }
      const levels = [["high", "High"], ["balanced", "Balanced"], ["compact", "Compact"]];
      const sizes = [[0.15, "Small"], [0.23, "Medium"], [0.36, "Large"]];
      if (!sizes.some(([scale]) => scale === settings.cameraScale))
        sizes.push([settings.cameraScale, "Custom · " + Math.round(settings.cameraScale * 100) + "%"]);
      items.push(setting("profileId", "Profile", settings.profiles),
        setting("camera", "Camera bubble"), setting("cameraScale", "Camera size", sizes),
        setting("mic", "Microphone"), setting("microphoneId", "Microphone input", settings.inputs),
        setting("systemAudio", "System audio"), setting("toolbar", "Floating controls"),
        setting("screenQuality", "Screen quality", levels), setting("cameraQuality", "Camera quality", levels));
    }
    items.push({ id: "open", label: "Open glint", kind: "button", apply: onOpen, dismiss: true },
      { id: "quit", label: "Quit glint", kind: "button", apply: onQuit, dismiss: true });
    display("setup", items);
  }
  function idle() {
    recording = false;
    tray.setImage(icon);
    if (process.platform === "darwin") tray.setTitle("");
    tray.setToolTip(process.platform === "darwin" ? "" : "glint");
    rebuild();
  }
  idle();
  return {
    tray, idle, display,
    visible: panel.visible,
    destroy() { panel.destroy(); tray.destroy(); },
    beginRecording() { recording = true; },
    configure(next) { settings = next; rebuild(); },
  };
}

function recordingMenu(
  studio,
  onStop,
  onToggle,
  showToolbar,
  moveCamera,
  initialPosition,
  portraitOptions,
) {
  // A small red recording light, also visible against a dark menu bar.
  const bytes = Buffer.alloc(16 * 16 * 4);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const offset = 4 * (16 * y + x);
      bytes.set(
        [
          72,
          68,
          232,
          Math.round(
            255 * Math.max(0, Math.min(1, 6.5 - Math.hypot(x - 7.5, y - 7.5))),
          ),
        ],
        offset,
      );
    }
  const { tray } = studio;
  studio.beginRecording();
  tray.setImage(nativeImage.createFromBitmap(bytes, { width: 16, height: 16 }));
  const shortcut = "CommandOrControl+Shift+9";
  let registered = false,
    timer;
  let toolbar;
  function close() {
    toolbar?.close();
    clearInterval(timer);
    if (registered) globalShortcut.unregister(shortcut);
    studio.idle();
  }
  try {
    let position = initialPosition;
    function place(point) {
      position = { ...position, ...point };
      moveCamera(position);
      tick();
    }
    toolbar = require("./toolbar.cjs").recordingToolbar({
      toggle: onToggle,
      stop: onStop,
      position: moveCamera ? place : null,
      initialPosition,
      captureArea: portraitOptions?.area,
      initialBounds: portraitOptions?.toolbarBounds,
      portraitOptions: moveCamera ? portraitOptions : null,
    });
    if (showToolbar) toolbar.show();
    registered = globalShortcut.register(shortcut, onStop);
    let paused = false,
      base = 0,
      started = Date.now();
    function tick() {
      const seconds = Math.floor(
        (base + (paused ? 0 : Date.now() - started)) / 1000,
      );
      const clock =
        Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
      if (process.platform === "darwin")
        tray.setTitle((paused ? "Ⅱ " : "") + clock);
      const actions = [
        {id: "toggle", label: paused ? "Resume recording" : "Pause recording", kind: "button", apply: onToggle},
        {id: "stop", label: "Stop recording", primary: true, kind: "button", dismiss: true, apply: onStop},
        {id: "show", label: "Show floating controls", kind: "button", apply: () => toolbar.show()},
      ];
      if (moveCamera) {
        const scale = position.scale ?? 0.23;
        const sizes = [[0.15,"Small"],[0.23,"Medium"],[0.36,"Large"],[0.48,"Extra large"]];
        if (!sizes.some(([n]) => n === scale)) sizes.push([scale,"Custom"]);
        const corners = [["0,0","Top left"],["1,0","Top right"],["0,1","Bottom left"],["1,1","Bottom right"]];
        const corner = position.x + "," + position.y;
        if (!corners.some(([key]) => key === corner)) corners.push([corner,"Custom"]);
        actions.push(
          {id:"showCamera",label:"Show camera preview",kind:"button",apply:()=>toolbar.showCamera()},
          {id:"scale",label:"Camera size",kind:"select",value:scale,options:sizes,apply:(scale)=>place({scale})},
          {id:"corner",label:"Camera position",kind:"select",value:corner,options:corners,apply:(key)=>{
            const [x,y] = key.split(",").map(Number);
            place({x,y});
          }},
        );
      }
      studio.display("recording", actions, clock);
      toolbar.update({ clock, paused, frameSize: portraitOptions?.frameSize, position: moveCamera ? position : null });
      tray.setToolTip("glint · " + (paused ? "Paused " : "Recording ") + clock);
    }
    tick();
    timer = setInterval(tick, 1000);
    return {
      ready: toolbar.ready,
      close,
      setArea: (area) => toolbar.setArea(area),
      portrait: (frame) => toolbar.portrait(frame),
      update(value, ms) {
        paused = value;
        base = ms;
        started = Date.now();
        tick();
      },
    };
  } catch (error) {
    close();
    throw error;
  }
}
module.exports = { studioMenu, recordingMenu };
