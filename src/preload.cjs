const { contextBridge, ipcRenderer } = require("electron");
const methods = [
  "profiles",
  "save",
  "sources",
  "source",
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
  onCameraPosition(callback){
    const listener=(_,point)=>callback(point);
    ipcRenderer.on("cameraPosition",listener);
    return ()=>ipcRenderer.removeListener("cameraPosition",listener);
  },
  onRecordingToggle(callback){
    const listener=()=>callback();
    ipcRenderer.on("toggleRecording",listener);
    return ()=>ipcRenderer.removeListener("toggleRecording",listener);
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
