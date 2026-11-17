const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { execFile } = require("node:child_process");
const run = require("node:util").promisify(execFile);

async function trimRecording(library, id, start, end, cuts = []) {
  const original = library.db
    .prepare("SELECT * FROM videos WHERE id=? AND ready=1")
    .get(id);
  if (!original) throw Error("Recording unavailable.");
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start ||
    (original.durationMs && end > Math.ceil(original.durationMs / 1000))
  )
    throw Error("Choose an end time after the start and within the recording.");
  if (!Array.isArray(cuts) || cuts.length > 100)
    throw Error("Invalid cut list.");
  let previous = start;
  let removed = 0;
  for (const range of cuts) {
    if (!Array.isArray(range) || range.length !== 2)
      throw Error("Invalid cut range.");
    const [a, b] = range;
    if (
      !Number.isFinite(a) ||
      !Number.isFinite(b) ||
      a < previous ||
      b <= a ||
      b > end
    )
      throw Error("Cut ranges must be ordered and inside the recording.");
    removed += b - a;
    previous = b;
  }
  if (end - start - removed < 0.001) throw Error("Keep part of the recording.");
  const editArgs = ["-ss", String(start), "-t", String(end - start)];
  if (cuts.length) {
    const exclude = cuts
      .map(([a, b]) => "gte(t," + a + ")*lt(t," + b + ")")
      .join("+");
    const offsets = cuts
      .map(([a, b]) => "gte(T," + b + ")*" + (b - a))
      .join("+");
    const filter =
      "select='gte(t," +
      start +
      ")*lt(t," +
      end +
      ")*not(" +
      exclude +
      ")',setpts='PTS-(" +
      start +
      "+" +
      offsets +
      ")/TB'";
    editArgs.splice(
      0,
      editArgs.length,
      "-vf",
      filter,
      "-af",
      "a" + filter.replace(",setpts", ",asetpts"),
      "-fps_mode",
      "vfr",
    );
  }
  const binary = require("./ffmpeg.cjs").ffmpegBinary();
  const copy = randomUUID();
  const output = library.file(copy);
  try {
    const { stdout } = await run(binary, [
      "-nostdin",
      "-v",
      "error",
      "-progress",
      "pipe:1",
      "-nostats",
      "-i",
      library.file(id),
      ...editArgs,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-c:v",
      "libvpx-vp9",
      "-deadline",
      "realtime",
      "-cpu-used",
      "6",
      "-c:a",
      "libopus",
      output,
    ]);
    const durationMs = Math.round(
      Number([...stdout.matchAll(/^out_time_us=(\d+)/gm)].pop()?.[1]) / 1000,
    );
    if (!(durationMs > 0)) throw Error("No video in the selected range.");
    library.db
      .prepare(
        "INSERT INTO videos(id,profile,created,account,folder,privacy,title,durationMs,ready) VALUES(?,?,?,?,?,?,?,?,1)",
      )
      .run(
        copy,
        original.profile,
        new Date().toISOString(),
        original.account,
        original.folder,
        original.privacy,
        (original.title || "Recording").slice(0, 150) +
          (cuts.length ? " · cut" : " · trim"),
        durationMs,
      );
    return copy;
  } catch (error) {
    fs.rmSync(output, { force: true });
    if (error.code === "ENOENT")
      throw Error("Install FFmpeg to trim recordings on this Mac.");
    if (error.stderr)
      throw Error(
        "Could not trim this recording. " + error.stderr.trim().slice(-500),
      );
    throw error;
  }
}
module.exports = { trimRecording };
