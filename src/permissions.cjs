// macOS permissions glint needs. Onboarding shows their status and asks for
// them; launch only unlocks the keychain so uploads never prompt mid-session.
const kinds = ["screen", "microphone", "camera"];
const panes = {
  screen: "Privacy_ScreenCapture",
  microphone: "Privacy_Microphone",
  camera: "Privacy_Camera",
};

function status({ platform, systemPreferences }) {
  return Object.fromEntries(
    kinds.map((kind) => [
      kind,
      platform === "darwin" ? systemPreferences.getMediaAccessStatus(kind) : "granted",
    ]),
  );
}

async function request(kind, { platform, systemPreferences, desktopCapturer }) {
  if (!kinds.includes(kind)) throw Error("Unknown permission.");
  if (platform === "darwin") {
    if (kind === "screen") {
      // Screen Recording has no request API; listing sources shows the macOS prompt.
      await desktopCapturer
        .getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } })
        .catch(() => {});
    } else if (systemPreferences.getMediaAccessStatus(kind) === "not-determined") {
      await systemPreferences.askForMediaAccess(kind);
    }
  }
  return status({ platform, systemPreferences })[kind];
}

function settingsUrl(kind) {
  if (!kinds.includes(kind)) throw Error("Unknown permission.");
  return "x-apple.systempreferences:com.apple.preference.security?" + panes[kind];
}

// Reading a saved Google sign-in unlocks glint's keychain item at launch
// rather than at the first upload.
function unlockKeychain(google, log = console) {
  try {
    return google.unlock();
  } catch (e) {
    log.error("Keychain unlock:", e.message);
    return false;
  }
}

module.exports = { status, request, settingsUrl, unlockKeychain };
