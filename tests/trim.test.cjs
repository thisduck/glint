const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Store } = require("../src/store.cjs"),
  { Library } = require("../src/library.cjs"),
  { trimRecording } = require("../src/trim.cjs");
test(
  "trim creates a playable local copy with its own title, duration and upload state",
  { skip: spawnSync("ffmpeg", ["-version"]).status !== 0 },
  async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glint-edit-"));
    t.after(() => fs.rmSync(dir, { recursive: true }));
    const lib = new Library(new Store(":memory:"), dir);
    const id = lib.begin(1);
    const sample = spawnSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=96x64:r=10:d=2",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "-c:a",
      "libopus",
      "-c:v",
      "libvpx-vp9",
      "-f",
      "webm",
      "-",
    ]);
    assert.equal(sample.status, 0);
    lib.append(id, sample.stdout);
    lib.end(id, true, 2000);
    lib.rename(id, "Walkthrough");
    await assert.rejects(trimRecording(lib, id, 1, 0), /end time/);
    const copy = await trimRecording(lib, id, 0.5, 1.5);
    const cut = await trimRecording(lib, id, 0, 2, [
      [0.4, 0.8],
      [1.2, 1.5],
    ]);
    assert.ok(
      Math.abs(lib.list(1).find((v) => v.id === cut).durationMs - 1300) <= 110,
    );
    await assert.rejects(trimRecording(lib, id, 0, 2, [[0, 2]]), /Keep part/);
    const audio = spawnSync("ffmpeg", [
      "-v",
      "error",
      "-i",
      lib.file(cut),
      "-map",
      "0:a:0",
      "-ar",
      "8000",
      "-ac",
      "1",
      "-f",
      "s16le",
      "-",
    ]);
    assert.equal(audio.status, 0);
    assert.ok(Math.abs(audio.stdout.length / 16000 - 1.3) < 0.06);
    const edited = lib.list(1).find((v) => v.id === copy);
    assert.equal(edited.title, "Walkthrough · trim");
    assert.ok(edited.durationMs >= 900 && edited.durationMs <= 1100);
    assert.equal(edited.uploadState, null);
    assert.deepEqual(fs.readFileSync(lib.file(id)), sample.stdout);
    assert.equal(
      spawnSync("ffmpeg", [
        "-v",
        "error",
        "-i",
        lib.file(copy),
        "-f",
        "null",
        "-",
      ]).status,
      0,
    );
  },
);
