// Ask for everything glint needs when it opens, so macOS prompts never
// interrupt a recording or appear after one ends.
async function requestUpfront({ platform, systemPreferences, desktopCapturer, google, log = console }) {
  if (platform === "darwin") {
    // Screen Recording has no request API; listing sources shows the macOS prompt.
    if (systemPreferences.getMediaAccessStatus("screen") === "not-determined") {
      await desktopCapturer
        .getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } })
        .catch((e) => log.error("Screen Recording request:", e.message));
    }
    for (const kind of ["microphone", "camera"]) {
      if (systemPreferences.getMediaAccessStatus(kind) === "not-determined") {
        await systemPreferences
          .askForMediaAccess(kind)
          .catch((e) => log.error(kind + " request:", e.message));
      }
    }
  }
  // Reading a saved Google sign-in unlocks glint's keychain item now rather
  // than at the first upload.
  try {
    google.unlock();
  } catch (e) {
    log.error("Keychain unlock:", e.message);
  }
}
module.exports = { requestUpfront };
