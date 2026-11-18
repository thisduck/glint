const test = require("node:test"),
  assert = require("node:assert/strict");
test("pause freezes elapsed time, resume restarts it, and stop and cleanup work from either state", (t) => {
  let now = 1000,
    menu, dispatch, mode, profileId, hides = 0,
    shortcut,
    toolbarState,
    toolbarCommands;
  let stops = 0,
    toggles = 0,
    destroyed = false,
    closed = false;
  t.mock.method(Date, "now", () => now);
  const electron = require.resolve("electron"),
    toolbar = require.resolve("../src/toolbar.cjs");
  const panel = require.resolve("../src/tray-panel.cjs");
  const previous = [require.cache[electron], require.cache[toolbar], require.cache[panel]];
  require.cache[panel] = { exports: { trayPanel(_tray, onAction) {
    dispatch = (id, value) => onAction(mode, id, value, profileId);
    return {
      update(state) { menu = state.rows; mode = state.mode; profileId = state.profileId; },
      hide() { hides++; },
      destroy() {},
    };
  } } };
  require.cache[electron] = {
    exports: {
      Tray: class {
        setContextMenu(items) {
          menu = items;
        }
        setImage() {}
        setTitle() {}
        setToolTip() {}
        destroy() {
          destroyed = true;
        }
      },
      Menu: { buildFromTemplate: (v) => v },
      globalShortcut: {
        register(_k, cb) {
          shortcut = cb;
          return true;
        },
        unregister() {
          shortcut = null;
        },
      },
      nativeImage: { createFromBitmap() {}, createFromPath: () => ({ setTemplateImage() {} }) },
    },
  };
  require.cache[toolbar] = {
    exports: {
      recordingToolbar(commands) {
        toolbarCommands = commands;
        return {
          show() {},
          update(s) {
            toolbarState = s;
          },
          close() {
            closed = true;
          },
        };
      },
    },
  };
  t.after(() => {
    for (const [i, key] of [electron, toolbar, panel].entries()) {
      if (previous[i]) require.cache[key] = previous[i];
      else delete require.cache[key];
    }
  });
  const toolbarBounds = { x: -850, y: 100, width: 360, height: 52 };
  const { studioMenu, recordingMenu } = require("../src/recording-menu.cjs");
  let starts = 0;
  const changed = [];
  const studio = studioMenu(() => starts++, () => {}, () => {}, (...args) => changed.push(args));
  const prefs = {
    profileId: 1, profileName: "Work", profiles: [[1, "Work"]],
    inputs: [["default", "System default"]], microphoneId: "default",
    camera: true, mic: true, toolbar: true, systemAudio: false, cameraScale: 0.23,
    screenQuality: "high", cameraQuality: "compact", locked: false,
  };
  studio.configure(prefs);
  const camera = menu.find((item) => item.label === "Camera bubble");
  assert.ok(camera.value);
  dispatch(camera.id, false);
  assert.equal(hides, 0);
  assert.deepEqual(changed, [[1, "camera", false]]);

  dispatch("new");
  const controls = recordingMenu(
    studio,
    () => stops++,
    () => toggles++,
    true,
    () => {},
    { x: 0, y: 0 },
    { frameSize: { width: 1920, height: 1080 }, toolbarBounds },
  );
  t.after(() => {
    if (!closed) controls.close();
  });
  studio.configure({ ...prefs, camera: false });
  assert.ok(!menu.some((item) => item.label === "New recording…"));
  assert.deepEqual(toolbarCommands.initialBounds, toolbarBounds);
  dispatch("toggle");
  controls.update(true, 4500);
  now += 10000;
  toolbarCommands.position({ x: 1, y: 1 });
  assert.deepEqual(toolbarState, {
    clock: "0:04",
    frameSize: { width: 1920, height: 1080 },
    paused: true,
    position: { x: 1, y: 1 },
  });
  dispatch("scale", "0.36");
  assert.equal(hides, 1);
  toolbarCommands.position({ x: 0.25, y: 0.75 });
  assert.deepEqual(toolbarState.position, { x: 0.25, y: 0.75, scale: 0.36 });
  dispatch("toggle");
  controls.update(false, 4500);
  now += 2000;
  toolbarCommands.position({ x: 0, y: 1 });
  assert.equal(toolbarState.clock, "0:06");
  shortcut();
  toolbarCommands.stop();
  assert.equal(stops, 2);
  assert.equal(toggles, 2);
  controls.close();
  assert.ok(!destroyed && closed && !shortcut);
  assert.equal(menu.find((item) => item.label === "Camera bubble").value, false);
  dispatch("new");
  assert.equal(starts, 2);
  studio.tray.destroy();
});
