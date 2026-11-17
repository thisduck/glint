import { packager } from "@electron/packager";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import config from "../src/google-config.cjs";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");
const root = path.resolve(import.meta.dirname, "..");
const settings = config.publisherConfig(process.env);
const out = path.resolve(
  process.env.GLINT_RELEASE_DIR || path.join(root, "release"),
);
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "glint-release-"));
try {
  const app = path.join(tmp, "source");
  await fs.mkdir(app);
  for (const dir of ["src", "dist", "build"])
    await fs.cp(path.join(root, dir), path.join(app, dir), {
      recursive: true,
      filter: (file) => !file.endsWith(".tsx"),
    });
  await fs.writeFile(
    path.join(app, "package.json"),
    JSON.stringify({
      name: pkg.name,
      productName: pkg.productName,
      version: pkg.version,
      main: pkg.main,
    }),
  );
  await fs.writeFile(
    path.join(app, config.filename),
    JSON.stringify(settings),
    { mode: 0o600 },
  );
  const [bundle] = await packager({
    dir: app,
    out: tmp + "/packaged",
    name: "glint",
    appBundleId: "app.glint.recorder",
    electronVersion: require("electron/package.json").version,
    electronZipDir: process.env.ELECTRON_ZIP_DIR,
    platform: "darwin",
    arch: process.arch,
    prune: false,
    icon: path.join(root, "build/icon.icns"),
    extendInfo: {
      NSCameraUsageDescription:"Include your camera when you turn on the camera bubble.",
      NSMicrophoneUsageDescription:
        "Record narration when you enable the microphone.",
      NSScreenCaptureUsageDescription:
        "Record the screen or window you select.",
    },
  });
  const archive = `glint-${pkg.version}-mac-${process.arch}.zip`;
  execFileSync("/usr/bin/ditto", [
    "-c",
    "-k",
    "--keepParent",
    path.join(bundle, "glint.app"),
    path.join(tmp, archive),
  ]);
  await fs.mkdir(out, { recursive: true });
  await fs.copyFile(path.join(tmp, archive), path.join(out, archive));
  console.log("Created " + path.join(out, archive));
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}
