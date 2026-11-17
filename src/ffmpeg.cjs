const fs = require("node:fs");
function ffmpegBinary() {
  return (
    ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"].find((p) =>
      fs.existsSync(p),
    ) || "ffmpeg"
  );
}
module.exports = { ffmpegBinary };
