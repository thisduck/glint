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
      fileInfo: async () => ({
        ownedByMe: true,
        permissions: [{ role: "owner" }],
      }),
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

test("an identity-only grant prompts for Drive consent on exchange and refresh", async (t) => {
  const store = new Store(":memory:");
  const google = new Google(store, {}, () => {}, {
    GOOGLE_CLIENT_ID: "test",
    GOOGLE_CLIENT_SECRET: "test",
  });
  let scope = "openid email";
  t.mock.method(global, "fetch", async () =>
    Response.json({ scope, access_token: "test-access" }),
  );
  for (const grant_type of ["authorization_code", "refresh_token"])
    await assert.rejects(
      google.token({ grant_type }),
      /Manage accounts and choose Reconnect/,
    );
  scope += " https://www.googleapis.com/auth/drive.file";
  assert.equal(
    (await google.token({ grant_type: "refresh_token" })).access_token,
    "test-access",
  );
});

test("disconnect clears the local grant and only its profiles' destinations", () => {
  const store = new Store(":memory:");
  const g = new Google(store);
  for (const p of store.profiles()) {
    store.db
      .prepare("INSERT INTO accounts VALUES(?,?,?)")
      .run(p.name, p.name, Buffer.from("token"));
    store.db
      .prepare(
        "UPDATE profiles SET account=?,folder='folder',autoUpload=1 WHERE id=?",
      )
      .run(p.name, p.id);
  }
  g.disconnect("Work");
  assert.deepEqual(
    g.accounts().map((a) => a.id),
    ["Personal"],
  );
  assert.deepEqual(
    store.profiles().map((p) => [p.account, p.folder, p.autoUpload]),
    [
      [null, null, 0],
      ["Personal", "folder", 1],
    ],
  );
});

test("private recordings stay local in a shared folder and retain their original privacy", async (t) => {
  const store = new Store(":memory:");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glint-private-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const lib = new Library(store, dir);
  store.db.exec("UPDATE profiles SET account='me',folder='shared' WHERE id=1");
  const id = lib.begin(1);
  lib.append(id, [1]);
  lib.end(id);
  store.setPrivacy(1, "link");
  const worker = new Uploads(
    lib,
    {
      access: async () => "token",
      fileInfo: async () => ({
        ownedByMe: true,
        permissions: [{ role: "owner" }, { role: "reader" }],
      }),
    },
    () => assert.fail("private content sent"),
  );
  await assert.rejects(worker.send(id), /only you/);
  assert.equal(lib.list(1)[0].privacy, "private");
  assert.equal(lib.list(1)[0].remote, null);
});

test("a rejected link grant can retry without uploading the file again", async (t) => {
  const store = new Store(":memory:");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "glint-link-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const lib = new Library(store, dir);
  store.db.exec(
    "UPDATE profiles SET account='me',folder='target',privacy='link' WHERE id=1",
  );
  const id = lib.begin(1);
  lib.append(id, [1]);
  lib.end(id);
  store.db
    .prepare(
      "UPDATE videos SET remote='uploaded',uploadState='pending' WHERE id=?",
    )
    .run(id);
  let blocked = true;
  const worker = new Uploads(
    lib,
    {
      access: async () => "token",
      enableLink: async (remote) => {
        assert.equal(remote, "uploaded");
        if (blocked) throw Error("Organization policy");
      },
    },
    () => assert.fail("duplicate upload"),
  );
  await worker.drain();
  assert.equal(lib.list(1)[0].uploadError, "Organization policy");
  blocked = false;
  await worker.send(id);
  assert.equal(lib.list(1)[0].uploadError, null);
});

test("changing one file's link preserves named grants and respects inherited access",async t=>{
  const g=new Google(new Store(":memory:"));
  let inherited=false;
  g.filePermissions=async()=>[{id:"person",type:"user"},{id:"public",type:"anyone",permissionDetails:[{inherited}]}];
  const calls=[];
  t.mock.method(global,"fetch",async(url,opts)=>{calls.push([url,opts.method]);return new Response(null,{status:204});});
  await g.changeLink("clip",{},false);
  assert.equal(calls.length,1);
  assert.match(calls[0][0],/files\/clip\/permissions\/public\?/);
  assert.equal(calls[0][1],"DELETE");
  inherited=true;
  await assert.rejects(g.changeLink("clip",{},false),/containing folder/);
  assert.equal(calls.length,1);
});

test("failed trash keeps the recording; successful trash clears the row and its cached assets",async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"glint-trash-"));
  t.after(()=>fs.rmSync(dir,{recursive:true}));
  const lib=new Library(new Store(":memory:"),dir);
  new Uploads(lib,{});
  const id=lib.begin(1);lib.append(id,[1]);lib.end(id);
  fs.writeFileSync(path.join(dir,id+".timeline.jpg"),"cache");
  lib.db.prepare("INSERT INTO upload_ids VALUES(?,?)").run(id,"cloud");
  await assert.rejects(lib.trash(id,async()=>{throw Error("busy");}),/busy/);
  assert.equal(lib.list(1).length,1);
  await lib.trash(id,async file=>fs.renameSync(file,path.join(dir,"trashed.webm")));
  assert.equal(lib.list(1).length,0);
  assert.equal(fs.existsSync(path.join(dir,id+".timeline.jpg")),false);
  assert.equal(lib.db.prepare("SELECT * FROM upload_ids").all().length,0);
});
