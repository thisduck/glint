const { contextBridge, ipcRenderer } = require("electron");
const methods = [
  "profiles",
  "save",
  "sources",
  "source",
  "countdown",
  "showStudio",
  "recordingMenu",
  "begin",
  "append",
  "end",
  "renameRecording",
  "trimRecording",
  "filmstrip",
  "list",
  "setAutoUpload",
  "setPrivacy",
  "setFileAccess",
  "deleteRecording",
  "setMicrophone",
  "driveConfigured",
  "accounts",
  "connect",
  "disconnect",
  "folder",
  "recordingsFolder",
  "upload",
  "share",
  "driveDetails",
  "reveal",
];
contextBridge.exposeInMainWorld("desk", {
  onStopRecording(callback) {
    const listener = () => callback();
    ipcRenderer.on("stopRecording", listener);
    return () => ipcRenderer.removeListener("stopRecording", listener);
  },
  ...Object.fromEntries(
    methods.map((k) => [k, (...args) => ipcRenderer.invoke(k, ...args)]),
  ),
});
