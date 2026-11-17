const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
test("countdown hides the studio, cancels on Escape and releases the global key", async (t) => {
  let escape,
    hidden = false,
    overlay;
  class Window extends EventEmitter {
    constructor() {
      super();
      overlay = this;
      this.webContents = new EventEmitter();
    }
    setVisibleOnAllWorkspaces() {}
    async loadFile() {}
    showInactive() {
      queueMicrotask(() => escape());
    }
    isDestroyed() {
      return false;
    }
    destroy() {
      this.destroyed = true;
      this.emit("closed");
    }
  }
  const electron = require.resolve("electron");
  const previous = require.cache[electron];
  require.cache[electron] = {
    exports: {
      BrowserWindow: Window,
      globalShortcut: {
        register(key, fn) {
          assert.equal(key, "Escape");
          escape = fn;
          return true;
        },
        unregister() {
          escape = null;
        },
      },
    },
  };
  t.after(() => {
    if (previous) require.cache[electron] = previous;
    else delete require.cache[electron];
  });
  const result = await require("../src/countdown.cjs").countdown({
    hide() {
      hidden = true;
    },
  });
  assert.equal(result, false);
  assert.ok(hidden && overlay.destroyed);
  assert.equal(escape, null);
});

test("countdown uses the selected monitor or the current bounds of the selected window",async()=>{
  const {captureBounds,countdownBounds}=require("../src/capture-bounds.cjs");
  const displays=[{id:1,bounds:{x:0,y:0,width:1440,height:900}},{id:9,bounds:{x:-1920,y:-180,width:1920,height:1080}}];
  const monitor=await captureBounds({id:"screen:1:0",display_id:"9"},displays);
  assert.deepEqual(countdownBounds(monitor,displays),{width:158,height:132,x:-1039,y:294});
  const window=await captureBounds({id:"window:4321:0"},displays,async id=>{
    assert.equal(id,"4321");
    return {x:-500,y:30,width:600,height:500};
  });
  assert.deepEqual(countdownBounds(window,displays),{width:158,height:132,x:-329,y:214});
  await assert.rejects(captureBounds({id:"window:1:0"},displays,async()=>null),/could not be located/);
});
