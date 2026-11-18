const test = require("node:test"),
  assert = require("node:assert/strict");
test("pause freezes elapsed time, resume restarts it, and stop and cleanup work from either state", (t) => {
  let now = 1000,
    menu,
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
  const previous = [require.cache[electron], require.cache[toolbar]];
  require.cache[electron] = {
    exports: {
      Tray: class {
        setContextMenu(items) {
          menu = items;
        }
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
      nativeImage: { createFromBitmap() {} },
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
    for (const [i, key] of [electron, toolbar].entries()) {
      if (previous[i]) require.cache[key] = previous[i];
      else delete require.cache[key];
    }
  });
  const toolbarBounds = { x: -850, y: 100, width: 360, height: 52 };
  const controls = require("../src/recording-menu.cjs").recordingMenu(
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
  assert.deepEqual(toolbarCommands.initialBounds, toolbarBounds);
  menu.find((item) => item.label === "Pause recording").click();
  controls.update(true, 4500);
  now += 10000;
  toolbarCommands.position({ x: 1, y: 1 });
  assert.deepEqual(toolbarState, {
    clock: "0:04",
    frameSize: { width: 1920, height: 1080 },
    paused: true,
    position: { x: 1, y: 1 },
  });
  const cameraMenu = menu.find((item) => item.label === "Camera size");
  cameraMenu.submenu.find((item) => item.label === "Large").click();
  toolbarCommands.position({ x: 0.25, y: 0.75 });
  assert.deepEqual(toolbarState.position, { x: 0.25, y: 0.75, scale: 0.36 });
  menu.find((item) => item.label === "Resume recording").click();
  controls.update(false, 4500);
  now += 2000;
  toolbarCommands.position({ x: 0, y: 1 });
  assert.equal(toolbarState.clock, "0:06");
  shortcut();
  toolbarCommands.stop();
  assert.equal(stops, 2);
  assert.equal(toggles, 2);
  controls.close();
  assert.ok(destroyed && closed && !shortcut);
});
