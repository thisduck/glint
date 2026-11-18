const { contextBridge, ipcRenderer } = require("electron");
const methods = [
  "profiles",
  "save",
  "sources",
  "source",
  "openSetup",
  "updateSetup",
  "closeSetup",
  "countdown",
  "showStudio",
  "recordingMenu",
  "recordingStatus",
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
  "setCaptureOption",
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
  "openCaptureSettings",
];
contextBridge.exposeInMainWorld("desk", {
  isMac: process.platform === "darwin",
  sendPortrait(frame) {
    ipcRenderer.send("cameraPortrait", frame);
  },
  onPortraitRequest(callback) {
    const listener = () => callback();
    ipcRenderer.on("portraitRequest", listener);
    return () => ipcRenderer.removeListener("portraitRequest", listener);
  },
  onSetupCommand(callback) {
    const listener = (_, action) => callback(action);
    ipcRenderer.on("setupCommand", listener);
    return () => ipcRenderer.removeListener("setupCommand", listener);
  },
  onCameraPosition(callback) {
    const listener = (_, point) => callback(point);
    ipcRenderer.on("cameraPosition", listener);
    return () => ipcRenderer.removeListener("cameraPosition", listener);
  },
  onRecordingToggle(callback) {
    const listener = () => callback();
    ipcRenderer.on("toggleRecording", listener);
    return () => ipcRenderer.removeListener("toggleRecording", listener);
  },
  onStopRecording(callback) {
    const listener = () => callback();
    ipcRenderer.on("stopRecording", listener);
    return () => ipcRenderer.removeListener("stopRecording", listener);
  },
  ...Object.fromEntries(
    methods.map((k) => [k, (...args) => ipcRenderer.invoke(k, ...args)]),
  ),
});
