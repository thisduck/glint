const test = require("node:test");
const assert = require("node:assert");
const { status, request, settingsUrl, unlockKeychain } = require("../src/permissions.cjs");

function mac(initial) {
  const state = { ...initial }, calls = [];
  return {
    state,
    calls,
    deps: {
      platform: "darwin",
      systemPreferences: {
        getMediaAccessStatus: (kind) => state[kind],
        askForMediaAccess: async (kind) => { calls.push(["ask", kind]); state[kind] = "granted"; return true; },
      },
      desktopCapturer: { getSources: async () => { calls.push(["screen"]); state.screen = "granted"; return []; } },
    },
  };
}

test("reports each permission's macOS status", () => {
  const { deps } = mac({ screen: "denied", microphone: "granted", camera: "not-determined" });
  assert.deepStrictEqual(status(deps), { screen: "denied", microphone: "granted", camera: "not-determined" });
});

test("treats permissions as granted off macOS", () => {
  assert.deepStrictEqual(status({ platform: "linux" }), { screen: "granted", microphone: "granted", camera: "granted" });
});

test("asks macOS only for undecided camera and microphone access", async () => {
  const { deps, calls } = mac({ screen: "granted", microphone: "not-determined", camera: "denied" });
  assert.strictEqual(await request("microphone", deps), "granted");
  assert.strictEqual(await request("camera", deps), "denied");
  assert.deepStrictEqual(calls, [["ask", "microphone"]]);
});

test("requests Screen Recording by listing sources", async () => {
  const { deps, calls } = mac({ screen: "not-determined", microphone: "granted", camera: "granted" });
  assert.strictEqual(await request("screen", deps), "granted");
  assert.deepStrictEqual(calls, [["screen"]]);
});

test("rejects unknown permissions", async () => {
  const { deps } = mac({});
  await assert.rejects(request("location", deps), /Unknown permission/);
  assert.throws(() => settingsUrl("location"), /Unknown permission/);
});

test("opens the matching privacy pane", () => {
  assert.match(settingsUrl("camera"), /Privacy_Camera$/);
  assert.match(settingsUrl("screen"), /Privacy_ScreenCapture$/);
});

test("a keychain failure does not stop startup", () => {
  const errors = [];
  const ok = unlockKeychain({ unlock: () => { throw Error("User canceled"); } }, { error: (...a) => errors.push(a) });
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(errors, [["Keychain unlock:", "User canceled"]]);
});
