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
  const listedSources = new Map();
  let selected = null;
  let previewTarget;
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
  handle("setPrivacy", (id, privacy) => store.setPrivacy(id, privacy));
  handle("setCaptureOption", (...args) => store.setCaptureOption(...args));
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
  const editingFiles = new Set();
  async function editFile(id, operation) {
    const video = store.db
      .prepare("SELECT * FROM videos WHERE id=? AND ready=1")
      .get(id);
    if (!video) throw Error("Recording unavailable.");
    if (
      editingFiles.has(id) ||
      uploads.busy.has(id) ||
      video.uploadState === "pending"
    )
      throw Error("Wait for the current operation to finish.");
    editingFiles.add(id);
    try {
      return await operation(video);
    } finally {
      editingFiles.delete(id);
    }
  }
  handle("upload", (id) => {
    if (editingFiles.has(id))
      throw Error("Wait for the recording change to finish.");
    const queued = store.db
      .prepare(
        "UPDATE videos SET uploadState='pending',uploadError=NULL WHERE id=? AND ready=1 AND (remote IS NULL OR uploadState='failed')",
      )
      .run(id);
    if (!queued.changes) throw Error("Recording is unavailable for upload.");
    resumeUploads();
  });
  async function uploadedFile(id) {
    const video = store.db
      .prepare("SELECT remote,account FROM videos WHERE id=? AND ready=1")
      .get(id);
    if (!video?.remote) throw Error("Upload this recording first.");
    const headers = {
      Authorization: "Bearer " + (await google.access(video.account)),
    };
    const info = await google.fileInfo(video.remote, headers);
    return { info, remote: video.remote, headers };
  }
  async function driveDetails(id) {
    const { info, remote, headers } = await uploadedFile(id);
    let accessIssue;
    if (!info.permissions) {
      try {
        info.permissions = await google.filePermissions(remote, headers);
      } catch (error) {
        accessIssue = error.message;
      }
    }
    return {
      accessIssue,
      access: require("./drive-status.cjs").describeAccess(info),
      metadata: !!info.videoMediaMetadata?.durationMillis,
      link: info.webViewLink,
    };
  }
  handle("deleteRecording", (id, alsoDrive) =>
    editFile(id, async (video) => {
      if (alsoDrive === true && video.remote)
        await google.trashFile(video.remote, video.account);
      await library.trash(id, (file) => shell.trashItem(file));
    }),
  );
  handle("driveDetails", driveDetails);
  handle("setFileAccess", (id, privacy) =>
    editFile(id, async (video) => {
      if (!["folder", "private", "link"].includes(privacy))
        throw Error("Unknown access setting.");
      if (video.remote) {
        if (privacy === "private")
          throw Error("Choose restricted link access for uploaded files.");
        await google.changeLink(
          video.remote,
          { Authorization: "Bearer " + (await google.access(video.account)) },
          privacy === "link",
        );
      }
      store.db
        .prepare(
          "UPDATE videos SET privacy=?,uploadState=CASE WHEN remote IS NULL THEN uploadState ELSE NULL END,uploadError=CASE WHEN remote IS NULL THEN uploadError ELSE NULL END WHERE id=?",
        )
        .run(privacy, id);
    }),
  );
  handle("reveal", (id) => shell.showItemInFolder(library.file(id)));
  handle("share", async (id, copy) => {
    const { info } = await uploadedFile(id);
    const link = info.webViewLink;
    if (!link || new URL(link).origin !== "https://drive.google.com")
      throw Error("Drive has not returned a viewing link yet.");
    return copy ? clipboard.writeText(link) : shell.openExternal(link);
  });
  handle("sources", async (kind) => {
    const types = kind === undefined ? ["screen", "window"] : [kind];
    if (types.some((type) => type !== "screen" && type !== "window"))
      throw Error("Unknown capture source type.");
    const items = await desktopCapturer.getSources({
      types,
      thumbnailSize: { width: 400, height: 225 },
    });
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
    for (const id of listedSources.keys()) {
      if (types.includes(id.split(":")[0])) listedSources.delete(id);
    }
    for (const { id, name, display_id } of items)
      listedSources.set(id, { id, name, display_id });
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
    previewTarget = video;
    selected = null;
    cb(req.audioRequested ? { video, audio: "loopback" } : { video });
  });
  let preparation;
  function closeSetup(restore) {
    if (!preparation) return;
    preparation.close();
    preparation = null;
    if (restore && !win.isDestroyed()) win.show();
  }
  handle("openSetup", async (id, settings) => {
    const target = previewTarget;
    if (!target || target.id !== id || library.open)
      throw Error("Choose a capture source again.");
    closeSetup(false);
    const session = require("./preparation.cjs").prepareSource(
      target,
      settings,
      (channel, value) => win.webContents.send(channel, value),
      () => {
        if (preparation !== session) return;
        closeSetup(true);
        win.webContents.send("setupCommand", "sourceLost");
      },
    );
    preparation = session;
    try {
      await session.ready;
      if (preparation !== session) return false;
      if (target.id !== win.getMediaSourceId()) win.hide();
      return true;
    } catch (error) {
      if (preparation === session) closeSetup(true);
      throw error;
    }
  });
  handle("updateSetup", (changes) => preparation?.update(changes));
  handle("closeSetup", (restore) => closeSetup(restore === true));
  let recordingArea, outline, followTimer;
  function clearOutline() {
    clearTimeout(followTimer);
    if (outline && !outline.isDestroyed()) outline.destroy();
    outline = null;
  }
  handle("countdown", async (id) => {
    const { captureBounds, countdownBounds } = require("./capture-bounds.cjs");
    const displays = require("electron").screen.getAllDisplays();
    closeSetup(false);
    const target =
      previewTarget?.id === id ? previewTarget : listedSources.get(id);
    recordingArea = await captureBounds(target, displays);
    const card = countdownBounds(recordingArea, displays);
    clearOutline();
    outline = await require("./capture-outline.cjs").captureOutline(
      recordingArea,
    );
    try {
      const proceed = await require("./countdown.cjs").countdown(win, card);
      if (!proceed || !id.startsWith("window:")) clearOutline();
      else {
        const current = outline;
        async function follow() {
          if (current !== outline) return;
          try {
            const next = await captureBounds(
              target,
              require("electron").screen.getAllDisplays(),
            );
            if (current !== outline) return;
            if (
              ["x", "y", "width", "height"].some(
                (k) => recordingArea[k] !== next[k],
              )
            ) {
              recordingArea = next;
              current.setBounds(next);
              closeRecordingMenu?.setArea(next);
            }
          } catch {
            if (current === outline) clearOutline();
            return;
          }
          followTimer = setTimeout(follow, 1000);
        }
        followTimer = setTimeout(follow, 1000);
      }
      return proceed;
    } catch (error) {
      clearOutline();
      throw error;
    }
  });
  let closeRecordingMenu;
  function foregroundStudio() {
    if (win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
  function restoreStudio() {
    closeSetup(false);
    clearOutline();
    closeRecordingMenu?.close();
    closeRecordingMenu = null;
    foregroundStudio();
  }
  handle("showStudio", restoreStudio);
  handle("recordingMenu", (showToolbar, cameraOn, position, windowCapture, frameSize) => {
    if (!library.open || closeRecordingMenu)
      throw Error("Recording unavailable.");
    closeRecordingMenu = require("./recording-menu.cjs").recordingMenu(
      () => win.webContents.send("stopRecording"),
      () => win.webContents.send("toggleRecording"),
      showToolbar === true,
      cameraOn
        ? (point) => win.webContents.send("cameraPosition", point)
        : null,
      position || { x: 1, y: 1 },
      {
        frameSize,
        desktop: windowCapture === true,
        area: recordingArea,
        request: () => win.webContents.send("portraitRequest"),
      },
    );
  });
  ipcMain.on("cameraPortrait", (event, frame) => {
    if (
      event.senderFrame === win.webContents.mainFrame &&
      typeof frame === "string" &&
      frame.length < 200000 &&
      frame.startsWith("data:image/jpeg;base64,")
    ) {
      preparation?.portrait(frame);
      closeRecordingMenu?.portrait(frame);
    }
  });
  handle("recordingStatus", (paused, ms) =>
    closeRecordingMenu?.update(paused, ms),
  );
  handle("begin", (id) => library.begin(id));
  handle("append", (id, data) => library.append(id, data));
  handle("filmstrip", (id) =>
    require("./filmstrip.cjs").filmstrip(library, id),
  );
  handle("trimRecording", (id, start, end, cuts) =>
    require("./trim.cjs").trimRecording(library, id, start, end, cuts),
  );
  handle("renameRecording", (id, title) => library.rename(id, title));
  handle("end", (id, complete = true, durationMs, issue) => {
    library.end(id, complete, durationMs, issue);
    resumeUploads();
  });
  handle("list", (id) =>
    library
      .list(id)
      .map((v) => ({ ...v, progress: uploads.progress.get(v.id) })),
  );
  handle("profiles", () =>
    store.profiles().map((profile) => ({ ...profile, canSetPrivacy: true, canSaveCaptureOptions: true })),
  );
  handle("save", (name, id) => store.save(name, id));
  win = new BrowserWindow({
    icon: appIcon,
    width: 950,
    height: 720,
    webPreferences: {
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const reopenStudio = () => {
    if (!preparation && !library.open && !outline) foregroundStudio();
  };
  app.on("activate", reopenStudio);
  app.on("second-instance", reopenStudio);
  let lastRendererRecovery = 0;
  win.webContents.on("render-process-gone", (_, details) => {
    console.error("Studio renderer exited", details.reason, details.exitCode);
    if (details.reason === "clean-exit" || win.isDestroyed()) return;
    if (library.open) {
      try {
        library.end(library.open.id, false);
      } catch (error) {
        console.error("Recovering interrupted recording:", error.message);
      }
    }
    restoreStudio();
    // Avoid an automatic reload loop if a media decoder repeatedly crashes.
    if (Date.now() - lastRendererRecovery > 30000) {
      lastRendererRecovery = Date.now();
      win.reload();
    }
  });
  win.on("closed", () => {
    closeSetup(false);
    clearOutline();
    closeRecordingMenu?.close();
  });
  win.loadFile(path.join(__dirname, "index.html"));
});
app.on("window-all-closed", () => app.quit());
