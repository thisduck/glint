const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
test("countdown hides the studio, cancels on Escape and releases the global key",async t => {
  let escape, hidden = false, overlay;
  class Window extends EventEmitter {
    constructor(){super();overlay=this;this.webContents=new EventEmitter();}
    setVisibleOnAllWorkspaces(){}
    async loadFile(){}
    showInactive(){ queueMicrotask(()=>escape()); }
    isDestroyed(){return false;}
    destroy(){this.destroyed=true;this.emit("closed");}
  }
  const electron = require.resolve("electron");
  const previous = require.cache[electron];
  require.cache[electron] = {exports:{BrowserWindow:Window,globalShortcut:{
    register(key,fn){assert.equal(key,"Escape"); escape=fn; return true;},
    unregister(){escape=null;}
  }}};
  t.after(()=>{if(previous) require.cache[electron]=previous; else delete require.cache[electron];});
  const result = await require("../src/countdown.cjs").countdown({hide(){hidden=true;}});
  assert.equal(result,false);
  assert.ok(hidden && overlay.destroyed);
  assert.equal(escape,null);
});
