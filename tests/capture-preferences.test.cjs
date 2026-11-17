const test = require("node:test");
const assert = require("node:assert/strict");
const { Store } = require("../src/store.cjs");

test("renderer reload keeps switches against an old desktop process and imports them once on upgrade", async () => {
  const {saveCaptureSwitch,loadProfiles} = await import("../src/capture-preferences.mjs");
  const entries = new Map();
  const storage = {setItem:(k,v)=>entries.set(k,v), getItem:k=>entries.get(k)??null, removeItem:k=>entries.delete(k)};
  const legacy = {profiles:async()=>[{id:1},{id:2}],setCaptureOption:()=>assert.fail("old main has no handler")};
  let [work, personal] = await loadProfiles(legacy,storage);
  assert.equal(work.toolbarEnabled,1);
  await saveCaptureSwitch(legacy,storage,work,"toolbarEnabled",false);
  await saveCaptureSwitch(legacy,storage,personal,"cameraEnabled",false);
  const snapshot = rows=>rows.map(p=>[p.toolbarEnabled,p.cameraEnabled]);
  assert.deepEqual(snapshot(await loadProfiles(legacy,storage)),[[0,1],[1,0]]);
  const store=new Store(":memory:");
  try {
    const modern={profiles:()=>store.profiles().map(p=>({...p,canSaveCaptureOptions:true})),setCaptureOption:(...args)=>store.setCaptureOption(...args)};
    assert.deepEqual(snapshot(await loadProfiles(modern,storage)),[[0,1],[1,0]]);
    assert.equal(entries.size,0);
    [work] = await loadProfiles(modern,storage);
    await saveCaptureSwitch(modern,storage,work,"toolbarEnabled",true);
    assert.deepEqual(snapshot(await loadProfiles(modern,storage)),[[1,1],[1,0]]);
  } finally {store.db.close();}
});
