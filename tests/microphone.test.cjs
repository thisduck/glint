const test = require("node:test");
const assert = require("node:assert/strict");
const { Store } = require("../src/store.cjs");

test("profiles remember independent microphone and mute settings after reopening", (t) => {
  const fs = require("node:fs");
  const path = require("node:path");
  const dir = fs.mkdtempSync(
    path.join(require("node:os").tmpdir(), "glint-mic-"),
  );
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const file = path.join(dir, "library.sqlite");
  const store = new Store(file);
  store.setMicrophone(1, "headset", false);
  store.db.close();
  const reopened = new Store(file);
  assert.deepEqual(
    reopened.profiles().map((p) => [p.microphoneId, p.micEnabled]),
    [
      ["headset", 0],
      ["default", 1],
    ],
  );
  reopened.db.close();
});

for (const missing of [false, true]) {
  test(
    "microphone falls back " + (missing ? "at startup" : "when unplugged"),
    async () => {
      const { openMicrophone } = await import("../src/microphone.mjs");
      const calls = [];
      const makeStream = () => {
        const track = {
          readyState: "live",
          stop() {
            this.readyState = "ended";
          },
        };
        return { getAudioTracks: () => [track], getTracks: () => [track] };
      };
      const output = makeStream();
      let input,
        closed = false,
        fallback = 0;
      const devices = {
        async getUserMedia({ audio }) {
          calls.push(audio);
          if (missing && audio !== true) throw Error("absent");
          return (input = makeStream());
        },
      };
      const context = {
        createMediaStreamDestination: () => ({ stream: output }),
        async resume() {},
        async close() {
          closed = true;
        },
        createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
      };
      const mic = await openMicrophone(
        devices,
        "usb",
        () => fallback++,
        assert.fail,
        context,
      );
      if (!missing) await input.getTracks()[0].onended();
      assert.deepEqual(calls, [{ deviceId: { exact: "usb" } }, true]);
      assert.equal(fallback, 1);
      assert.equal(mic.track, output.getTracks()[0]);
      mic.close();
      assert.equal(input.getTracks()[0].readyState, "ended");
      assert.equal(closed, true);
    },
  );
}
