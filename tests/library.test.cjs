const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { Library } = require("../src/library.cjs"),
  { Store } = require("../src/store.cjs");
test("chunk order, profile isolation, empty capture and recovery", (t) => {
  const s = new Store(":memory:"),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "clips-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const l = new Library(s, dir),
    id = l.begin(1);
  assert.throws(() => l.begin(2));
  l.append(id, [1]);
  l.append(id, [2]);
  l.end(id);
  assert.deepEqual([...fs.readFileSync(l.file(id))], [1, 2]);
  assert.equal(l.list(1)[0].id, id);
  assert.equal(l.list(2).length, 0);
  const empty = l.begin(2);
  assert.throws(() => l.end(empty));
  const partial = l.begin(2);
  l.append(partial, [3]);
  fs.closeSync(l.open.fd);
  assert.equal(new Library(s, dir).list(2)[0].id, partial);
});
test("an interrupted recording stays local even when auto-upload is enabled",t=>{
 const s=new Store(":memory:"), dir=fs.mkdtempSync(path.join(os.tmpdir(),"clips-"));
 t.after(()=>fs.rmSync(dir,{recursive:true}));s.db.exec("UPDATE profiles SET account='me', folder='drive-folder',autoUpload=1 WHERE id=1");
 const l=new Library(s,dir),id=l.begin(1);l.append(id,[7]);l.end(id,false);
 assert.equal(l.list(1)[0].uploadState,null);assert.deepEqual([...fs.readFileSync(l.file(id))],[7]);
});
