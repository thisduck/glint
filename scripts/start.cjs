const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const { productName } = require("../package.json");

function macExecutable(electron) {
  // macOS reads the app switcher label from the enclosing bundle, even when
  // Electron is running an app from source. Keep the installed runtime intact.
  const version = require("electron/package.json").version;
  const cache = path.join(root, "node_modules", ".cache", "glint", process.arch, version);
  const bundle = path.join(cache, productName + ".app");
  const executable = path.join(bundle, "Contents", "MacOS", productName);
  if (fs.existsSync(executable)) return executable;

  fs.mkdirSync(cache, { recursive: true });
  const temp = fs.mkdtempSync(path.join(cache, "prepare-"));
  try {
    const staged = path.join(temp, productName + ".app");
    execFileSync("ditto", [path.resolve(electron, "../../.."), staged]);
    const plist = path.join(staged, "Contents", "Info.plist");
    for (const key of ["CFBundleName", "CFBundleDisplayName", "CFBundleExecutable"])
      execFileSync("plutil", ["-replace", key, "-string", productName, plist]);
    execFileSync("plutil", ["-replace", "CFBundleIdentifier", "-string", "app.glint.recorder.dev", plist]);
    const macOS = path.join(staged, "Contents", "MacOS");
    fs.renameSync(path.join(macOS, "Electron"), path.join(macOS, productName));
    execFileSync("codesign", ["--force", "--sign", "-", staged]);
    try {
      fs.renameSync(staged, bundle);
    } catch (error) {
      if (!fs.existsSync(executable)) throw error;
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  return executable;
}

const electron = require("electron");
const executable = process.platform === "darwin" ? macExecutable(electron) : electron;
const child = spawn(executable, [root, ...process.argv.slice(2)], { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
});
