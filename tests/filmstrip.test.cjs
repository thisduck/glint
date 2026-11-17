const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { spawnSync } = require("node:child_process");
const { filmstrip } = require("../src/filmstrip.cjs");
const { Library } = require("../src/library.cjs");
const { Store } = require("../src/store.cjs");
test(
  "older recordings get a duration and a cached ten-frame JPEG timeline",
  { skip: spawnSync("ffmpeg", ["-version"]).status !== 0 },
  async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glint-film-"));
    t.after(() => fs.rmSync(dir, { recursive: true }));
    const lib = new Library(new Store(":memory:"), dir);
    const id = lib.begin(1);
    const input = spawnSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=96x64:rate=10:duration=2",
      "-c:v",
      "libvpx-vp9",
      "-f",
      "webm",
      "-",
    ]);
    assert.equal(input.status, 0);
    lib.append(id, input.stdout);
    lib.end(id);
    const strip = await filmstrip(lib, id);
    assert.ok(strip.duration >= 1.9 && strip.duration <= 2.1);
    const buffer = Buffer.from(strip.image.split(",")[1], "base64");
    const probe = spawnSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=p=0",
        "-i",
        "pipe:0",
      ],
      { input: buffer },
    );
    assert.equal(probe.stdout.toString().trim(), "1440,80");
    assert.deepEqual(await filmstrip(lib, id), strip);
  },
);
