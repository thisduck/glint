const { contextBridge, ipcRenderer } = require("electron");
const methods = [
  "profiles",
  "save",
  "sources",
  "source",
  "begin",
  "append",
  "end",
  "list",
  "setAutoUpload",
  "driveConfigured",
  "accounts",
  "connect",
  "disconnect",
  "folder",
  "recordingsFolder",
  "upload",
  "share",
];
contextBridge.exposeInMainWorld(
  "desk",
  Object.fromEntries(
    methods.map((k) => [k, (...args) => ipcRenderer.invoke(k, ...args)]),
  ),
);
