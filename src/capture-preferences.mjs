const switches = ["cameraEnabled", "toolbarEnabled"];
const key = (id, option) => "glint.profile." + id + ".pending." + option;

// Reloading the renderer can load newer UI while the original desktop process
// still owns the database. Keep explicit choices until that process upgrades.
export async function saveCaptureSwitch(api, storage, profile, option, enabled) {
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
