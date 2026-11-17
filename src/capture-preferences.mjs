const switches = ["cameraEnabled", "toolbarEnabled"];
const key = (id, option) => "glint.profile." + id + ".pending." + option;

// Reloading the renderer can load newer UI while the original desktop process
// still owns the database. Keep explicit choices until that process upgrades.
export async function saveCaptureSwitch(
  api,
  storage,
  profile,
  option,
  enabled,
) {
  if (!switches.includes(option) || typeof enabled !== "boolean")
    throw Error("Invalid capture preference.");
  if (profile.canSaveCaptureOptions && api.setCaptureOption) {
    await api.setCaptureOption(profile.id, option, enabled);
  } else {
    storage.setItem(key(profile.id, option), String(enabled));
  }
}

export async function loadProfiles(api, storage) {
  const profiles = await api.profiles();
  for (const profile of profiles) {
    for (const option of switches) {
      const entry = key(profile.id, option);
      const pending = storage.getItem(entry);
      if (pending === "true" || pending === "false") {
        const enabled = pending === "true";
        if (profile.canSaveCaptureOptions && api.setCaptureOption) {
          await api.setCaptureOption(profile.id, option, enabled);
          storage.removeItem(entry);
        }
        profile[option] = Number(enabled);
      } else {
        profile[option] ??= 1;
      }
    }
  }
  return profiles;
}

export function loadCameraFrame(storage, id) {
  const fallback = { x: 1, y: 1, scale: 0.23 };
  try {
    const point = JSON.parse(
      storage.getItem("glint.profile." + id + ".cameraFrame"),
    );
    if (
      point &&
      [point.x, point.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) &&
      Number.isFinite(point.scale) &&
      point.scale >= 0.1 &&
      point.scale <= 0.48
    )
      return point;
  } catch {}
  return fallback;
}

export function saveCameraFrame(storage, id, point) {
  storage.setItem(
    "glint.profile." + id + ".cameraFrame",
    JSON.stringify(point),
  );
}
