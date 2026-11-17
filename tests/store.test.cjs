const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { Store } = require("../src/store.cjs");
test("profiles survive restart with renamed defaults and additional profiles", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glint-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const file = path.join(dir, "library"),
    s = new Store(file);
  assert.deepEqual(
    s.profiles().map((p) => p.name),
    ["Work", "Personal"],
  );
  s.save("Studio", 1);
  s.save("Client");
  assert.throws(() => s.save("  "));
  s.db.close();
  const again = new Store(file);
  assert.deepEqual(
    again.profiles().map((p) => p.name),
    ["Studio", "Personal", "Client"],
  );
  again.db.close();
});

test("capture switches migrate enabled and retain independent choices per profile", t => {
  const { DatabaseSync } = require("node:sqlite");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),"glint-prefs-"));
  t.after(()=>fs.rmSync(dir,{recursive:true}));
  const file = path.join(dir,"library");
  const legacy = new DatabaseSync(file);
  legacy.exec("CREATE TABLE profiles(id INTEGER PRIMARY KEY,name TEXT NOT NULL,account TEXT,folder TEXT,folderName TEXT,micEnabled INTEGER NOT NULL DEFAULT 1); INSERT INTO profiles(name,micEnabled) VALUES('Work',0),('Personal',1)");
  legacy.close();
  const store = new Store(file);
  const switches = s=>s.profiles().map(p=>[p.micEnabled,p.cameraEnabled,p.toolbarEnabled]);
  assert.deepEqual(switches(store),[[0,1,1],[1,1,1]]);
  store.setCaptureOption(1,"cameraEnabled",false);
  store.setCaptureOption(2,"toolbarEnabled",false);
  store.save("Client");
  store.db.close();
  const reopened=new Store(file);
  assert.deepEqual(switches(reopened),[[0,0,1],[1,1,0],[1,1,1]]);
  reopened.db.close();
});
