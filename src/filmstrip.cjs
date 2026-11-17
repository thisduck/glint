const fs = require("node:fs/promises");
const path = require("node:path");
const run = require("node:util").promisify(
  require("node:child_process").execFile,
);
const { ffmpegBinary } = require("./ffmpeg.cjs");

// Source WebMs from MediaRecorder can omit the duration header. Remuxing to a
// null sink reads packet timestamps without decoding or modifying the source.
async function filmstrip(library, id) {
  const video = library.db
    .prepare("SELECT durationMs FROM videos WHERE id=? AND ready=1")
    .get(id);
  if (!video) throw Error("Recording unavailable.");
  const file = library.file(id);
  const cache = path.join(library.dir, id + ".timeline.jpg");
  let duration = video.durationMs / 1000;
  const binary = ffmpegBinary();
  try {
    if (!(duration > 0)) {
      const { stdout } = await run(binary, [
        "-nostdin",
        "-v",
        "error",
        "-progress",
        "pipe:1",
        "-i",
        file,
        "-c",
        "copy",
        "-f",
        "null",
        "-",
      ]);
      const ms = Math.round(
        Number([...stdout.matchAll(/^out_time_us=(\d+)/gm)].pop()?.[1]) / 1000,
      );
      if (!(ms > 0)) throw Error("Could not read this recording’s length.");
      library.db
        .prepare("UPDATE videos SET durationMs=? WHERE id=?")
        .run(ms, id);
      duration = ms / 1000;
    }
    let data;
    try {
      data = await fs.readFile(cache);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const interval = duration / 10;
      const filter =
        "fps=" +
        1 / interval +
        ":start_time=0:round=up,scale=144:80:force_original_aspect_ratio=decrease,pad=144:80:(ow-iw)/2:(oh-ih)/2,tile=10x1";
      const { stdout } = await run(
        binary,
        [
          "-nostdin",
          "-v",
          "error",
          "-i",
          file,
          "-an",
          "-vf",
          filter,
          "-frames:v",
          "1",
          "-c:v",
          "mjpeg",
          "-f",
          "image2pipe",
          "pipe:1",
        ],
        { encoding: "buffer" },
      );
      if (!stdout.length) throw Error("Could not read timeline frames.");
      data = stdout;
      const temporary = cache + "." + require("node:crypto").randomUUID();
      await fs.writeFile(temporary, data);
      await fs.rename(temporary, cache);
    }
    return {
      duration,
      image: "data:image/jpeg;base64," + data.toString("base64"),
    };
  } catch (error) {
    if (error.code === "ENOENT")
      throw Error("Install FFmpeg to load timeline frames and save clips.");
    throw error;
  }
}
module.exports = { filmstrip };
