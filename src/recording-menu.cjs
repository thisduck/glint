const { Tray, Menu, globalShortcut, nativeImage } = require("electron");

function recordingMenu(onStop,onToggle,showToolbar,moveCamera,initialPosition) {
  // A small red recording light, also visible against a dark menu bar.
  const bytes = Buffer.alloc(16 * 16 * 4);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const offset = 4 * (16 * y + x);
      bytes.set(
        [
          72,
          68,
          232,
          Math.round(
            255 * Math.max(0, Math.min(1, 6.5 - Math.hypot(x - 7.5, y - 7.5))),
          ),
        ],
        offset,
      );
    }
  const tray = new Tray(
    nativeImage.createFromBitmap(bytes, { width: 16, height: 16 }),
  );
  const shortcut = "CommandOrControl+Shift+9";
  let registered = false,
    timer;
  let toolbar;
  function close() {
    toolbar?.close();
    clearInterval(timer);
    if (registered) globalShortcut.unregister(shortcut);
    tray.destroy();
  }
  try {
    let position=initialPosition;
    function place(point){position=point;moveCamera(point);tick();}
    toolbar=require("./toolbar.cjs").recordingToolbar({toggle:onToggle,stop:onStop,position:moveCamera ? place : null});
    if(showToolbar)toolbar.show();
    registered = globalShortcut.register(shortcut, onStop);
    let paused=false,base=0,started=Date.now();
    function rebuild(){tray.setContextMenu(
      Menu.buildFromTemplate([
        ...(moveCamera ? [{label:"Camera position",submenu:["Top left","Top right","Bottom left","Bottom right"].map((label,i)=>({label,click:()=>place({x:i%2,y:Math.floor(i/2)})}))}] : []),
        {label:"Show floating controls",click:()=>toolbar.show()},
        {label:paused?"Resume recording":"Pause recording",click:onToggle},
        {
          label: registered ? "Stop recording (⌘⇧9)" : "Stop recording",
          click: onStop,
        },
      ]),
    );
    }
    rebuild();
    function tick() {
      const seconds = Math.floor((base + (paused ? 0 : Date.now()-started))/1000);
      const clock =
        Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
      if (process.platform === "darwin") tray.setTitle((paused ? "Ⅱ " : "")+clock);
      toolbar.update({clock,paused,position:moveCamera ? position : null});
      tray.setToolTip("glint · Recording " + clock);
    }
    tick();
    timer = setInterval(tick, 1000);
    return {close,update(value,ms){paused=value;base=ms;started=Date.now();rebuild();tick();}};
  } catch (error) {
    close();
    throw error;
  }
}
module.exports = { recordingMenu };
