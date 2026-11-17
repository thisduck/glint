const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
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
  let selected = null;
  const { Google } = require("./google.cjs");
  const { Uploads } = require("./uploads.cjs");
  const google = new Google(store, safeStorage, (url) =>
    shell.openExternal(url),
  );
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
  handle("sources", async () =>
    (await sources({ width: 400, height: 225 })).map(
      ({ id, name, thumbnail }) => ({
        id,
        name,
        thumbnail: thumbnail.isEmpty()
          ? null
          : "data:image/jpeg;base64," + thumbnail.toJPEG(75).toString("base64"),
      }),
    ),
  );
  const available = async (id) =>
    (await sources()).some((item) => item.id === id);
  handle("sourceAvailable", available);
  handle("source", async (id) => {
    if (!(await available(id))) return false;
    selected = id;
    return true;
  });
  session.defaultSession.setDisplayMediaRequestHandler(async (req, cb) => {
    const id = selected;
    selected = null;
    try {
      const video =
        req.frame === win.webContents.mainFrame &&
        (await sources()).find((s) => s.id === id);
      cb(video ? { video } : {});
    } catch {
      cb({});
    }
  });
  handle("begin", (id) => library.begin(id));
  handle("append", (id, data) => library.append(id, data));
  handle("end", (id) => library.end(id));
  handle("list", (id) => library.list(id));
  handle("profiles", () => store.profiles());
  handle("save", (name, id) => store.save(name, id));
  win = new BrowserWindow({
    width: 950,
    height: 720,
    webPreferences: { preload: path.join(__dirname, "preload.cjs") },
  });
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.loadFile(path.join(__dirname, "index.html"));
});
app.on("window-all-closed", () => app.quit());
