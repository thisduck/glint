const { Tray, Menu, globalShortcut, nativeImage } = require("electron");

function studioMenu(onNew, onOpen, onQuit, onSetting) {
  const icon = nativeImage.createFromPath(require("node:path").join(__dirname, "../build/trayTemplate.png"));
  icon.setTemplateImage(true);
  const tray = new Tray(icon);
  let settings;
  let recording = false;
  function rebuild() {
    if (recording) return;
    const items = [
      { label: settings?.previewing ? "Start recording" : "New recording…", enabled: !settings?.locked, click: onNew },
    ];
    if (settings) {
      const { profileId } = settings;
      const change = (key, value) => onSetting(profileId, key, value);
      const toggle = (key, label) => ({
        label, type: "checkbox", enabled: !settings.locked, checked: settings[key],
        click: (item) => change(key, item.checked),
      });
      const choices = (key, label, options) => ({
        label, enabled: !settings.locked,
        submenu: options.map(([value, name]) => ({
          label: name, type: "radio", checked: settings[key] === value,
          click: () => change(key, value),
        })),
      });
      const levels = [["high", "High"], ["balanced", "Balanced"], ["compact", "Compact"]];
      const sizes = [[0.15, "Small"], [0.23, "Medium"], [0.36, "Large"]];
      if (!sizes.some(([scale]) => scale === settings.cameraScale))
        sizes.push([settings.cameraScale, "Custom · " + Math.round(settings.cameraScale * 100) + "%"]);
      items.push(
        { type: "separator" },
        choices("profileId", "Profile · " + settings.profileName, settings.profiles),
        toggle("camera", "Camera bubble"),
        toggle("mic", "Microphone"),
        choices("microphoneId", "Microphone input", settings.inputs),
        toggle("systemAudio", "System audio"),
        toggle("toolbar", "Floating controls"),
        { type: "separator" },
        choices("cameraScale", "Camera size", sizes),
        choices("screenQuality", "Screen quality", levels),
        choices("cameraQuality", "Camera quality", levels),
      );
    }
    items.push({ type: "separator" }, { label: "Open glint", click: onOpen },
      { label: "Quit glint", click: onQuit });
    tray.setContextMenu(Menu.buildFromTemplate(items));
  }
  function idle() {
    recording = false;
    tray.setImage(icon);
    if (process.platform === "darwin") tray.setTitle("");
    tray.setToolTip("glint");
    rebuild();
  }
  idle();
  return {
    tray, idle,
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
    function rebuild() {
      tray.setContextMenu(
        Menu.buildFromTemplate([
          ...(moveCamera
            ? [
                {
                  label: "Show camera preview",
                  click: () => toolbar.showCamera(),
                },
                {
                  label: "Camera size",
                  submenu: [
                    ["Small", 0.15],
                    ["Medium", 0.23],
                    ["Large", 0.36],
                    ["Extra large", 0.48],
                  ].map(([label, scale]) => ({
                    label,
                    click: () => place({ scale }),
                  })),
                },
                {
                  label: "Camera position",
                  submenu: [
                    "Top left",
                    "Top right",
                    "Bottom left",
                    "Bottom right",
                  ].map((label, i) => ({
                    label,
                    click: () => place({ x: i % 2, y: Math.floor(i / 2) }),
                  })),
                },
              ]
            : []),
          { label: "Show floating controls", click: () => toolbar.show() },
          {
            label: paused ? "Resume recording" : "Pause recording",
            click: onToggle,
          },
          {
            label: registered ? "Stop recording (⌘⇧9)" : "Stop recording",
            click: onStop,
          },
        ]),
      );
    }
    rebuild();
    function tick() {
      const seconds = Math.floor(
        (base + (paused ? 0 : Date.now() - started)) / 1000,
      );
      const clock =
        Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
      if (process.platform === "darwin")
        tray.setTitle((paused ? "Ⅱ " : "") + clock);
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
        rebuild();
        tick();
      },
    };
  } catch (error) {
    close();
    throw error;
  }
}
module.exports = { studioMenu, recordingMenu };
