const test = require("node:test");
const assert = require("node:assert/strict");

// Exercise the real controller without requesting screen or camera permissions.
test("on-target setup keeps framing edits, deduplicates start and tears down before recording", async (t) => {
  let commands,
    state,
    shown = false,
    closed = false,
    outlined = true;
  const events = [];
  const mocks = {
    electron: {
      screen: {
        getAllDisplays: () => [
          { id: 9, bounds: { x: -1000, y: 0, width: 1000, height: 800 } },
        ],
      },
    },
    "../src/capture-outline.cjs": {
      captureOutline: async () => ({
        isDestroyed: () => !outlined,
        destroy() {
          outlined = false;
        },
      }),
    },
    "../src/toolbar.cjs": {
      recordingToolbar(options) {
        commands = options;
        return {
          ready: Promise.resolve(),
          update(value) {
            state = value;
          },
          show() {
            shown = true;
          },
          close() {
            closed = true;
          },
          portrait() {},
        };
      },
    },
  };
  for (const [name, exports] of Object.entries(mocks)) {
    const key = require.resolve(name),
      previous = require.cache[key];
    require.cache[key] = { exports };
    t.after(() => {
      if (previous) require.cache[key] = previous;
      else delete require.cache[key];
    });
  }
  const { prepareSource } = require("../src/preparation.cjs");
  const session = prepareSource(
    { id: "screen:9:0", name: "Display", display_id: "9" },
    { cameraOn: false, micOn: true, position: { x: 1, y: 1, scale: 0.23 } },
    (channel, value) => events.push([channel, value]),
    assert.fail,
  );
  await session.ready;
  assert.ok(shown);
  assert.equal(commands.captureArea.x, -1000);
  assert.equal(state.position, null);
  session.update({ cameraOn: true });
  commands.position({ x: 0.3, scale: 0.36 });
  assert.deepEqual(state.position, { x: 0.3, y: 1, scale: 0.36 });
  commands.start();
  commands.start();
  assert.deepEqual(
    events.filter(([channel]) => channel === "setupCommand"),
    [["setupCommand", "start"]],
  );
  session.close();
  assert.ok(closed && !outlined);
});
