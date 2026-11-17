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

test("auto-upload is opt-in, snapshots the folder and resumes saved work", async (t) => {
  const store = new Store(":memory:"),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "glint-auto-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const lib = new Library(store, dir);
  assert.throws(() => store.setAutoUpload(1, true), /folder/);
  store.db
    .prepare("UPDATE profiles SET account='work',folder='old' WHERE id=1")
    .run();
  store.setAutoUpload(1, true);
  function record(profile) {
    const id = lib.begin(profile);
    lib.append(id, [1]);
    lib.end(id);
    return id;
  }
  const automatic = record(1),
    local = record(2);
  store.setAutoUpload(1, false);
  store.db.prepare("UPDATE profiles SET folder='new' WHERE id=1").run();
  const manual = record(1),
    calls = [];
  const worker = new Uploads(lib, {
    access: async (account) => {
      calls.push(account);
      throw Error("offline");
    },
  });
  await Promise.all([worker.drain(), worker.drain()]);
  const row = (id) =>
    store.db.prepare("SELECT * FROM videos WHERE id=?").get(id);
  assert.deepEqual(calls, ["work"]);
  assert.equal(row(automatic).uploadState, "failed");
  assert.equal(row(automatic).folder, "old");
  assert.equal(row(manual).uploadState, null);
  assert.equal(row(local).uploadState, null);
  assert.ok(fs.existsSync(lib.file(automatic)));
});

test("profile folder setup skips Picker and reuses the reserved ID after a lost response", async (t) => {
  const store = new Store(":memory:"),
    google = new Google(store, {}, () => assert.fail("Picker opened"), {});
  google.access = async (account) => {
    assert.equal(account, "work");
    return "test-access";
  };
  let exists = false,
    allocations = 0;
  const folder = {
    id: "folder-1",
    name: "glint – Work",
    mimeType: "application/vnd.google-apps.folder",
    capabilities: { canAddChildren: true },
  };
  t.mock.method(global, "fetch", async (url, opts) => {
    assert.equal(opts.headers.Authorization, "Bearer test-access");
    if (url.includes("/generateIds")) {
      allocations++;
      return Response.json({ ids: [folder.id] });
    }
    if (opts.method === "POST") {
      assert.equal(JSON.parse(opts.body).id, folder.id);
      exists = true;
      throw Error("connection lost");
    }
    return exists ? Response.json(folder) : Response.json({}, { status: 404 });
  });
  await assert.rejects(google.recordingsFolder(1, "work"), /connection lost/);
  assert.equal(store.profiles()[0].folder, null);
  await google.recordingsFolder(1, "work");
  assert.equal(allocations, 1);
  assert.equal(store.profiles()[0].folder, folder.id);
  assert.equal(store.profiles()[1].folder, null);
});
