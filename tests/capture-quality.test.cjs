const test = require("node:test");
const assert = require("node:assert/strict");

test("capture quality defaults to high and remembers each input per profile", async () => {
  const { readCaptureQuality, saveCaptureQuality } = await import("../src/capture-quality.mjs");
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  const defaults = { screen: "high", camera: "high" };
  assert.deepEqual(readCaptureQuality(storage, 1), defaults);
  saveCaptureQuality(storage, 1, { screen: "high", camera: "compact" });
  assert.deepEqual(readCaptureQuality(storage, 1), { screen: "high", camera: "compact" });
  assert.deepEqual(readCaptureQuality(storage, 2), defaults);
  entries.set("glint.profile.2.quality", "{");
  assert.deepEqual(readCaptureQuality(storage, 2), defaults);
});

test("encoder budget scales with the captured pixels and selected quality", async () => {
  const { screenConstraints, cameraConstraints, recorderOptions } = await import("../src/capture-quality.mjs");
  assert.equal(screenConstraints("high").width.max, 3840);
  assert.equal(screenConstraints("compact").height.max, 1280);
  assert.deepEqual(cameraConstraints("high").height, { ideal: 1080 });
  const hd = { width: 1920, height: 1080, frameRate: 30 };
  const bitrate = (preset, settings) => recorderOptions(preset, settings).videoBitsPerSecond;
  assert.ok(bitrate("high", hd) > bitrate("balanced", hd));
  assert.ok(bitrate("balanced", hd) > bitrate("compact", hd));
  assert.equal(bitrate("high", { ...hd, width: 3840, height: 2160 }), 4 * bitrate("high", hd));
});
