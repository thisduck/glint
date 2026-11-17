const fs = require("node:fs"),
  path = require("node:path"),
  { randomUUID } = require("node:crypto");
class Library {
  constructor(store, dir) {
    this.db = store.db;
    this.dir = dir;
    this.open = null;
    fs.mkdirSync(dir, { recursive: true });
    for (const { id } of this.db
      .prepare("SELECT id FROM videos WHERE ready=0")
      .all()) {
      if (fs.existsSync(this.file(id)) && fs.statSync(this.file(id)).size)
        this.finishRow(id);
      else this.remove(id);
    }
  }
  file(id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw Error("Invalid recording");
    return path.join(this.dir, id + ".webm");
  }
  begin(profile) {
    if (this.open) throw Error("Recording already in progress");
    const id = randomUUID(),
      created = new Date().toISOString();
    const row = this.db
      .prepare("SELECT * FROM profiles WHERE id=?")
      .get(profile);
    if (!row) throw Error("Choose a profile");
    this.db
      .prepare(
        "INSERT INTO videos(id,created,profile,account,folder) VALUES(?,?,?,?,?)",
      )
      .run(id, created, profile, row.account, row.folder);
    const fd = fs.openSync(this.file(id), "wx");
    this.open = { id, fd };
    return id;
  }
  append(id, bytes) {
    if (this.open?.id !== id) throw Error("Recording is closed");
    fs.writeFileSync(this.open.fd, Buffer.from(bytes));
  }
  finishRow(id) {
    this.db.prepare("UPDATE videos SET ready=1 WHERE id=?").run(id);
  }
  remove(id) {
    fs.rmSync(this.file(id), { force: true });
    this.db.prepare("DELETE FROM videos WHERE id=?").run(id);
  }
  end(id) {
    if (this.open?.id !== id) throw Error("Recording is closed");
    fs.closeSync(this.open.fd);
    this.open = null;
    if (!fs.statSync(this.file(id)).size) {
      this.remove(id);
      throw Error("Captured no video");
    }
    this.finishRow(id);
  }
  list(profile) {
    return this.db
      .prepare(
        "SELECT * FROM videos WHERE profile=? AND ready=1 ORDER BY created DESC",
      )
      .all(profile);
  }
}
module.exports = { Library };
