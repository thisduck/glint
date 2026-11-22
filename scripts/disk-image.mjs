// The disk image people install from: glint.app beside an Applications shortcut, on a background that says to drag
// one onto the other (scripts/dmg/dmg-background.svg, rendered at 1x and 2x into the .tiff).
//
// Finder keeps a window's look in the volume's .DS_Store, and only Finder writes it: the image is first made
// writable, Finder is told how to show it, and then it is compressed. Where Finder cannot be scripted (no
// Automation permission, no window server) the image is still made, without the look.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const WINDOW = { width: 600, height: 400 };
const TITLE_BAR = 28;
const ICON_SIZE = 104;
const APP_AT = { x: 160, y: 225 };
const APPLICATIONS_AT = { x: 440, y: 225 };
const BACKGROUND = path.join(import.meta.dirname, "dmg/dmg-background.tiff");

/** What Finder is told. `disk` is the mounted volume's name, which gains a number when one of that name is mounted already. */
export function layoutScript(disk, app) {
  const quoted = (text) => `"${text.replace(/[\\"]/g, "\\$&")}"`;
  // The bounds are the whole window: the picture's area and the title bar above it.
  const bounds = (shrink = 0) => `{200, 120, ${200 + WINDOW.width - shrink}, ${120 + WINDOW.height + TITLE_BAR - shrink}}`;
  return `tell application "Finder"
  tell disk ${quoted(disk)}
    open
    delay 1
    tell container window
      set current view to icon view
      set toolbar visible to false
      set statusbar visible to false
      set the bounds to ${bounds()}
    end tell
    set viewOptions to the icon view options of container window
    set arrangement of viewOptions to not arranged
    set icon size of viewOptions to ${ICON_SIZE}
    set text size of viewOptions to 13
    set background picture of viewOptions to file ".background:${path.basename(BACKGROUND)}"
    set position of item ${quoted(app)} of container window to {${APP_AT.x}, ${APP_AT.y}}
    set position of item "Applications" of container window to {${APPLICATIONS_AT.x}, ${APPLICATIONS_AT.y}}
    close
    open
    delay 1
    -- Finder saves a window's size only once it has changed: resize it and put it back.
    tell container window
      set statusbar visible to false
      set the bounds to ${bounds(10)}
    end tell
    update without registering applications
    delay 1
    tell container window
      set statusbar visible to false
      set the bounds to ${bounds()}
    end tell
    update without registering applications
    delay 3
    close
  end tell
end tell`;
}

/**
 * Make `image` (a compressed .dmg) from `folder`, which holds the app and the Applications shortcut.
 * Returns whether the window's look was applied.
 */
export async function createDiskImage({ folder, app, volume, image, work }) {
  await fs.mkdir(path.join(folder, ".background"));
  await fs.copyFile(BACKGROUND, path.join(folder, ".background", path.basename(BACKGROUND)));
  const writable = path.join(work, "writable.dmg");
  // Room for Finder's .DS_Store beside the files.
  const megabytes = Number(execFileSync("du", ["-sm", folder]).toString().split(/\s/)[0]) + 20;
  execFileSync("hdiutil", ["create", "-volname", volume, "-srcfolder", folder, "-fs", "HFS+",
    "-format", "UDRW", "-size", `${megabytes}m`, writable], { stdio: "inherit" });
  const mount = path.join(work, "mount");
  await fs.mkdir(mount);
  // Mounted under /Volumes so Finder shows it as a disk; its name there is what the script addresses.
  const attached = execFileSync("hdiutil", ["attach", writable, "-readwrite", "-noverify", "-noautoopen"]).toString();
  const mounted = /(\/Volumes\/.+)$/m.exec(attached)?.[1]?.trim();
  if (!mounted) throw new Error("hdiutil did not say where it mounted the disk image.");
  let styled = true;
  try {
    execFileSync("osascript", ["-e", layoutScript(path.basename(mounted), app)], { stdio: ["ignore", "inherit", "pipe"], timeout: 120_000 });
    execFileSync("sync");
  } catch (error) {
    styled = false;
    console.warn(`Finder could not lay out the disk image; it opens as a plain window. ${String(error.stderr || error.message).trim()}`);
  } finally {
    detach(mounted);
  }
  execFileSync("hdiutil", ["convert", writable, "-format", "UDZO", "-imagekey", "zlib-level=9", "-o", image], { stdio: "inherit" });
  await fs.rm(writable);
  return styled;
}

/** Finder may still hold the volume for a moment after the script. */
function detach(mounted) {
  for (let attempt = 1; ; attempt++) {
    try { execFileSync("hdiutil", ["detach", mounted], { stdio: "ignore" }); return; } catch (error) {
      if (attempt === 5) { execFileSync("hdiutil", ["detach", mounted, "-force"], { stdio: "ignore" }); return; }
      execFileSync("sleep", ["2"]);
    }
  }
}
