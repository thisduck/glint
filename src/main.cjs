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
  const {loadConfig,missing} = require("./google-config.cjs");
  const config = loadConfig(app.getAppPath());
  const google = new Google(store, safeStorage, (url) => shell.openExternal(url),config);
  handle("driveConfigured",()=>missing(config).length===0);
  const uploads = new Uploads(library, google);
  handle("accounts", () => google.accounts());
  handle("connect", () => google.connect());
  handle("folder", (profile, account) => google.folder(profile, account));
  handle("upload", (id) => uploads.send(id));
  handle("share", (id, copy) => {
    const remote = store.db
      .prepare("SELECT remote FROM videos WHERE id=?")
      .get(id)?.remote;
    if (!remote) throw Error("Upload this recording first.");
    const url =
      "https://drive.google.com/file/d/" + encodeURIComponent(remote) + "/view";
    return copy ? clipboard.writeText(url) : shell.openExternal(url);
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
  handle("begin", (id) => library.begin(id));
  handle("append", (id, data) => library.append(id, data));
  handle("end", (id) => library.end(id));
  handle("list", (id) => library.list(id));
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
  win.loadFile(path.join(__dirname, "index.html"));
});
app.on("window-all-closed", () => app.quit());
