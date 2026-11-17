const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { Library } = require("../src/library.cjs"),
  { Store } = require("../src/store.cjs");
const { Uploads } = require("../src/uploads.cjs"),
  { Google } = require("../src/google.cjs");
test("upload retains original account and folder and reconciles an interrupted response", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "drive-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const store = new Store(":memory:"),
    l = new Library(store, dir);
  const db = store.db,
    configure = db.prepare("UPDATE profiles SET account=?,folder=? WHERE id=?");
  configure.run("work", "clients", 1);
  configure.run("personal", "family", 2);
  const id = l.begin(1);
  l.append(id, [7, 9]);
  l.end(id);
  configure.run("personal", "family", 1);
  let calls = 0;
  const request = async (url, opts) => {
    calls++;
    if (calls === 1) {
      assert.match(url, /generateIds/);
      return Response.json({ ids: ["reserved"] });
    }
    if (calls === 2) {
      assert.deepEqual(JSON.parse(opts.body).parents, ["clients"]);
      return new Response(null, {
        headers: { location: "https://www.googleapis.com/upload/session" },
      });
    }
    if (calls === 3) {
      const chunks = [];
      for await (const chunk of opts.body) chunks.push(chunk);
      assert.deepEqual([...Buffer.concat(chunks)], [7, 9]);
      throw Error("connection lost");
    }
    assert.match(url, /files\/reserved/);
    return Response.json({ id: "reserved" });
  };
  const u = new Uploads(
    l,
    {
      access: async (account) => {
        assert.equal(account, "work");
        return "access";
      },
    },
    request,
  );
  await assert.rejects(u.send(id), /connection lost/);
  assert.ok(fs.existsSync(l.file(id)));
  assert.equal(await u.send(id), "reserved");
  assert.equal(await u.send(id), "reserved");
  assert.equal(calls, 4);
});
test("account list omits credentials and missing OAuth settings fail before opening browser", async () => {
  const store = new Store(":memory:");
  store.db
    .prepare("INSERT INTO accounts VALUES(?,?,?)")
    .run("id", "me@example.com", Buffer.from("encrypted"));
  const g = new Google(store, {}, () => assert.fail("browser opened"), {});
  assert.deepEqual(
    { ...g.accounts()[0] },
    { id: "id", email: "me@example.com" },
  );
  await assert.rejects(g.connect(), /GOOGLE_CLIENT_ID/);
});
