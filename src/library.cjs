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
        this.finishRow(id, false);
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
        "INSERT INTO videos(id,created,profile,account,folder,privacy,uploadState) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        id,
        created,
        profile,
        row.account,
        row.folder,
        row.privacy,
        row.autoUpload && row.account && row.folder ? "pending" : null,
      );
    try {
      this.open = { id, fd: fs.openSync(this.file(id), "wx") };
    } catch (error) {
      this.db.prepare("DELETE FROM videos WHERE id=?").run(id);
      throw error;
    }
    return id;
  }
  append(id, bytes) {
    if (this.open?.id !== id) throw Error("Recording is closed");
    fs.writeFileSync(this.open.fd, Buffer.from(bytes));
  }
  finishRow(id, complete = true, issue) {
    this.db
      .prepare(
        "UPDATE videos SET ready=1,captureIssue=?,uploadState=CASE WHEN ? THEN uploadState ELSE NULL END WHERE id=?",
      )
      .run(
        complete
          ? null
          : issue || "Capture ended early. Play the local copy to review it.",
        Number(complete),
        id,
      );
  }
  remove(id) {
    fs.rmSync(this.file(id), { force: true });
    this.db.prepare("DELETE FROM videos WHERE id=?").run(id);
  }
  async trash(id, trashItem) {
    const file = this.file(id);
    if (fs.existsSync(file)) await trashItem(file);
    fs.rmSync(path.join(this.dir, id + ".timeline.jpg"), { force: true });
    this.db.exec("BEGIN");
    try {
      this.db.prepare("DELETE FROM upload_ids WHERE video=?").run(id);
      this.db.prepare("DELETE FROM videos WHERE id=?").run(id);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  rename(id, title) {
    if (typeof title !== "string" || !title.trim() || title.trim().length > 160)
      throw Error("Use a title between 1 and 160 characters.");
    if (
      !this.db
        .prepare("UPDATE videos SET title=? WHERE id=? AND ready=1")
        .run(title.trim(), id).changes
    )
      throw Error("Recording unavailable.");
  }
  end(id, complete = true, durationMs, issue) {
    if (this.open?.id !== id) throw Error("Recording is closed");
    fs.closeSync(this.open.fd);
    this.open = null;
    if (!fs.statSync(this.file(id)).size) {
      this.remove(id);
      throw Error("Captured no video");
    }
    if (Number.isSafeInteger(durationMs) && durationMs > 0)
      this.db
        .prepare("UPDATE videos SET durationMs=? WHERE id=?")
        .run(durationMs, id);
    this.finishRow(id, complete, issue);
  }
  async discard(id, trashItem) {
    if (this.open?.id !== id) throw Error("Recording is closed");
    fs.closeSync(this.open.fd);
    this.open = null;
    await this.trash(id, trashItem);
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
