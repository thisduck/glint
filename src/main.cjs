const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  systemPreferences,
  session,
  protocol,
  net,
  safeStorage,
  shell,
  clipboard,
} = require("electron");
const path = require("node:path");
const { Store } = require("./store.cjs");
const { Library } = require("./library.cjs");
const { pathToFileURL } = require("node:url");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "clip",
    privileges: { standard: true, secure: true, stream: true },
  },
]);
// Earlier releases reused the original library whenever it was present.
const { existsSync } = require("node:fs");
const hasLibrary = (dir) => existsSync(path.join(dir, "library.sqlite"));
if (!hasLibrary(app.getPath("userData"))) {
  const previous = ["cinderella", "snow white", "snow-white"]
    .map((name) => path.join(app.getPath("appData"), name))
    .find(hasLibrary);
  if (previous) app.setPath("userData", previous);
}
let win, store, library;
if (!app.requestSingleInstanceLock()) app.quit();
function handle(name, fn) {
  ipcMain.handle(name, (event, ...args) => {
    if (!win || event.senderFrame !== win.webContents.mainFrame)
      throw Error("Unknown window");
    return fn(...args);
  });
}
app.whenReady().then(() => {
  const appIcon = path.join(__dirname, "..", "build", "icon.png");
  if (process.platform === "darwin") app.dock.setIcon(appIcon);
  store = new Store(path.join(app.getPath("userData"), "library.sqlite"));
  library = new Library(
    store,
    path.join(app.getPath("userData"), "recordings"),
  );
  protocol.handle("clip", (req) =>
    net.fetch(
      pathToFileURL(library.file(new URL(req.url).pathname.slice(1))).href,
      { headers: req.headers },
    ),
  );
  const sources = (thumbnailSize = { width: 0, height: 0 }) =>
    desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize,
    });
  let listedSources = new Map();
  let selected = null;
  const { Google } = require("./google.cjs");
  const { Uploads } = require("./uploads.cjs");
  const { loadConfig, missing } = require("./google-config.cjs");
  const config = loadConfig(app.getAppPath(), process.env, !app.isPackaged);
  const google = new Google(
    store,
    safeStorage,
    (url) => shell.openExternal(url),
    config,
  );
  handle("driveConfigured", () => missing(config).length === 0);
  const uploads = new Uploads(library, google);
  handle("setPrivacy", (id,privacy) => store.setPrivacy(id,privacy));
  handle("setMicrophone", (...args) => store.setMicrophone(...args));
  handle("setAutoUpload", (id, enabled) => store.setAutoUpload(id, enabled));
  const resumeUploads = () =>
    uploads
      .drain()
      .catch((e) => console.error("Auto-upload queue:", e.message));
  resumeUploads();
  handle("accounts", () => google.accounts());
  handle("connect", (account) => google.connect(account));
  handle("disconnect", (account) => google.disconnect(account));
  handle("recordingsFolder", (profile, account) =>
    google.recordingsFolder(profile, account),
  );
  handle("folder", (profile, account) => google.folder(profile, account));
  handle("upload", id => {
    const queued = store.db.prepare("UPDATE videos SET uploadState='pending',uploadError=NULL WHERE id=? AND ready=1 AND (remote IS NULL OR uploadState='failed')").run(id);
    if (!queued.changes) throw Error("Recording is unavailable for upload.");
    resumeUploads();
  });
  async function driveDetails(id) {
    const video = store.db.prepare("SELECT remote,account FROM videos WHERE id=? AND ready=1").get(id);
    if (!video?.remote) throw Error("Upload this recording first.");
    const headers = {Authorization:"Bearer " + await google.access(video.account)};
    const info = await google.fileInfo(video.remote,headers);
    return {access:require("./drive-status.cjs").describeAccess(info), metadata:!!info.videoMediaMetadata?.durationMillis, link:info.webViewLink};
  }
  handle("driveDetails",driveDetails);
  handle("reveal",id => shell.showItemInFolder(library.file(id)));
  handle("share", async (id,copy) => {
    const {link} = await driveDetails(id);
    if (!link || new URL(link).origin !== "https://drive.google.com") throw Error("Drive has not returned a viewing link yet.");
    return copy ? clipboard.writeText(link) : shell.openExternal(link);
  });
  handle("sources", async () => {
    const items = await sources({ width: 400, height: 225 });
    if (
      process.platform === "darwin" &&
      ["restricted", "denied"].includes(
        systemPreferences.getMediaAccessStatus("screen"),
      )
    ) {
      throw Error(
        "Screen capture access is disabled. Allow Screen Recording in macOS System Settings, then relaunch glint.",
      );
    }
    listedSources = new Map(items.map(({ id, name }) => [id, { id, name }]));
    return items.map(({ id, name, thumbnail }) => ({
      id,
      name,
      thumbnail: thumbnail.isEmpty() ? null : thumbnail.toDataURL(),
    }));
  });
  handle("source", (id) => {
    selected = listedSources.get(id);
    if (!selected) throw Error("Choose a capture source again.");
  });
  session.defaultSession.setDisplayMediaRequestHandler((req, cb) => {
    if (req.frame !== win.webContents.mainFrame || !selected) {
      cb(null);
      return;
    }
    const video = selected;
    selected = null;
    cb({ video });
  });
  handle("countdown", () => require("./countdown.cjs").countdown(win));
  let closeRecordingMenu;
  function restoreStudio() {
    closeRecordingMenu?.();
    closeRecordingMenu = null;
    if (!win.isDestroyed()) win.show();
  }
  handle("showStudio", restoreStudio);
  handle("recordingMenu", () => {
    if (!library.open || closeRecordingMenu) throw Error("Recording unavailable.");
    closeRecordingMenu = require("./recording-menu.cjs").recordingMenu(() => win.webContents.send("stopRecording"));
  });
  handle("begin", (id) => library.begin(id));
  handle("append", (id, data) => library.append(id, data));
  handle("trimRecording",(id,start,end) => require("./trim.cjs").trimRecording(library,id,start,end));
  handle("renameRecording",(id,title) => library.rename(id,title));
  handle("end", (id, complete = true,durationMs,issue) => {
    library.end(id, complete,durationMs,issue);
    resumeUploads();
  });
  handle("list", (id) => library.list(id).map(v => ({...v,progress:uploads.progress.get(v.id)})));
  handle("profiles", () => store.profiles());
  handle("save", (name, id) => store.save(name, id));
  win = new BrowserWindow({
    icon: appIcon,
    width: 950,
    height: 720,
    webPreferences: { preload: path.join(__dirname, "preload.cjs") },
  });
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("render-process-gone", restoreStudio);
  win.on("closed", () => closeRecordingMenu?.());
  win.loadFile(path.join(__dirname, "index.html"));
});
app.on("window-all-closed", () => app.quit());
