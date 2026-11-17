const { contextBridge, ipcRenderer } = require("electron");
const methods = [
  "profiles",
  "save",
  "sources",
  "source",
  "sourceAvailable",
  "begin",
  "append",
  "end",
  "list",
  "accounts",
  "connect",
  "folder",
  "upload",
  "share",
];
contextBridge.exposeInMainWorld(
  "desk",
  Object.fromEntries(
    methods.map((k) => [k, (...args) => ipcRenderer.invoke(k, ...args)]),
  ),
);
