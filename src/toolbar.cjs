const {BrowserWindow,ipcMain,screen} = require("electron");
const path = require("node:path");

function recordingToolbar(commands) {
  const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const win=new BrowserWindow({
    x:area.x+18,y:area.y+area.height-84,width:360,height:60,
    frame:false,resizable:false,show:false,alwaysOnTop:true,skipTaskbar:true,
    acceptFirstMouse:true,backgroundColor:"#1b2236",
    webPreferences:{preload:path.join(__dirname,"toolbar-preload.cjs"),sandbox:true}
  });
  let state={clock:"0:00",paused:false};
  const receive=(event,action)=>{
    if(win.isDestroyed() || event.senderFrame!==win.webContents.mainFrame)return;
    if(action==="hide")win.hide();
    else commands[action]?.();
  };
  ipcMain.on("toolbarCommand",receive);
  win.once("closed",()=>ipcMain.removeListener("toolbarCommand",receive));
  win.setContentProtection(true);
  win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
  let visible=false;
  win.loadFile(path.join(__dirname,"toolbar.html")).then(()=>{
    if(!win.isDestroyed()){win.webContents.send("toolbarState",state);if(visible)win.showInactive();}
  }).catch(()=>{if(!win.isDestroyed())win.destroy();});
  return {
    show(){visible=true;if(!win.isDestroyed()&&!win.webContents.isLoading())win.showInactive();},
    update(next){state=next;if(!win.isDestroyed())win.webContents.send("toolbarState",next);},
    close(){if(!win.isDestroyed())win.destroy();}
  };
}
module.exports={recordingToolbar};
