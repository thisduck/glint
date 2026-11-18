const test = require("node:test");
const assert = require("node:assert");
const { requestUpfront } = require("../src/permissions.cjs");

function fakes(status) {
  const calls = [];
  return {
    calls,
    deps: {
      platform: "darwin",
      log: { error: (...a) => calls.push(["error", ...a]) },
      systemPreferences: {
        getMediaAccessStatus: (kind) => status[kind],
        askForMediaAccess: async (kind) => calls.push(["ask", kind]),
      },
      desktopCapturer: { getSources: async () => calls.push(["screen"]) },
      google: { unlock: () => calls.push(["unlock"]) },
    },
  };
}

test("asks for undecided permissions and unlocks the keychain at launch", async () => {
  const { calls, deps } = fakes({ screen: "not-determined", microphone: "not-determined", camera: "not-determined" });
  await requestUpfront(deps);
  assert.deepStrictEqual(calls, [["screen"], ["ask", "microphone"], ["ask", "camera"], ["unlock"]]);
});

test("skips permissions macOS has already decided", async () => {
  const { calls, deps } = fakes({ screen: "granted", microphone: "denied", camera: "granted" });
  await requestUpfront(deps);
  assert.deepStrictEqual(calls, [["unlock"]]);
});

test("a keychain failure does not stop startup", async () => {
  const { calls, deps } = fakes({ screen: "granted", microphone: "granted", camera: "granted" });
  deps.google.unlock = () => { throw Error("User canceled"); };
  await requestUpfront(deps);
  assert.deepStrictEqual(calls, [["error", "Keychain unlock:", "User canceled"]]);
});
