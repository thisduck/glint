const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { execFile } = require("node:child_process");
const run = require("node:util").promisify(execFile);

async function trimRecording(library, id, start, end) {
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
      "-ss",
      String(start),
      "-t",
      String(end - start),
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
        (original.title || "Recording").slice(0, 150) + " · trim",
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
