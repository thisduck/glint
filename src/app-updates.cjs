const feed = "https://github.com/thisduck/glint/releases/latest/download/updates-arm64.json";

function appUpdates({ updater, version, preferences, onChange, busy, beforeInstall }) {
  const labels = {
    idle: "Check for updates…",
    checking: "Checking for updates…",
    downloading: "Downloading update…",
    current: `Up to date (${version}) · Check again`,
    failed: "Update check failed · Retry",
    ready: "Update and restart",
    deferred: "Update and restart when work is finished",
    installing: "Restarting…",
  };
  let state = "idle";
  let enabled = preferences.read();
  function change(next) {
    state = next;
    onChange();
  }
  function check() {
    if (!["idle", "current", "failed"].includes(state)) return;
    change("checking");
    try {
      updater.checkForUpdates();
    } catch (error) {
      failed(error);
    }
  }
  function failed(error) {
    console.error("glint update:", error.message);
    change("failed");
  }
  function action() {
    if (state !== "ready" && state !== "deferred") return check();
    if (busy()) return change("deferred");
    change("installing");
    beforeInstall();
    updater.quitAndInstall();
  }
  updater.on("error", failed);
  updater.on("update-available", () => change("downloading"));
  updater.on("update-not-available", () => change("current"));
  updater.on("update-downloaded", () => change("ready"));
  updater.setFeedURL({ url: feed, serverType: "json" });

  function scheduledCheck() { if (enabled) check(); }
  const initial = setTimeout(scheduledCheck, 5000);
  const periodic = setInterval(scheduledCheck, 4 * 60 * 60 * 1000);
  return {
    rows() {
      return [
        { id: "autoUpdates", group: "Updates", kind: "switch", label: "Automatic updates",
          value: enabled, apply(value) {
            preferences.write(value);
            enabled = value;
            onChange();
            if (enabled) check();
          } },
        { id: "checkUpdates", group: "Updates", kind: "button", label: labels[state],
          disabled: ["checking", "downloading", "installing"].includes(state), apply: action },
      ];
    },
    close() { clearTimeout(initial); clearInterval(periodic); },
  };
}
module.exports = { appUpdates };
