const fs = require("node:fs");
class Uploads {
  constructor(library, google, request = fetch) {
    this.library = library;
    this.google = google;
    this.request = request;
    this.busy = new Set();
    library.db.exec(
      "CREATE TABLE IF NOT EXISTS upload_ids(video TEXT PRIMARY KEY, driveId TEXT NOT NULL)",
    );
  }
  async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      for (;;) {
        const next = this.library.db
          .prepare(
            "SELECT id FROM videos WHERE ready=1 AND uploadState='pending' AND remote IS NULL ORDER BY created LIMIT 1",
          )
          .get();
        if (!next) break;
        try {
          await this.send(next.id);
        } catch {
          this.library.db
            .prepare(
              "UPDATE videos SET uploadState='failed' WHERE id=? AND remote IS NULL",
            )
            .run(next.id);
        }
      }
    } finally {
      this.draining = false;
    }
  }
  async send(id) {
    if (this.busy.has(id)) throw Error("Upload already running");
    this.busy.add(id);
    try {
      return await this.upload(id);
    } finally {
      this.busy.delete(id);
    }
  }
  async upload(id) {
    const { db } = this.library;
    const video = db
      .prepare("SELECT * FROM videos WHERE id=? AND ready=1")
      .get(id);
    if (!video) throw Error("Recording unavailable");
    if (video.remote) return video.remote;
    if (!video.folder) {
      const p = db
        .prepare("SELECT * FROM profiles WHERE id=?")
        .get(video.profile);
      if (!p.folder)
        throw Error("Choose a Drive folder for this profile first.");
      db.prepare("UPDATE videos SET account=?,folder=? WHERE id=?").run(
        p.account,
        p.folder,
        id,
      );
      Object.assign(video, { account: p.account, folder: p.folder });
    }
    const headers = {
      Authorization: "Bearer " + (await this.google.access(video.account)),
    };
    const base = "https://www.googleapis.com/drive/v3/files";
    let driveId = db
      .prepare("SELECT driveId FROM upload_ids WHERE video=?")
      .get(id)?.driveId;
    const finish = () => {
      db.prepare("UPDATE videos SET remote=?,uploadState=NULL WHERE id=?").run(
        driveId,
        id,
      );
      return driveId;
    };
    if (driveId) {
      const check = await this.request(
        base + "/" + driveId + "?supportsAllDrives=true",
        { headers },
      );
      if (check.ok) return finish();
      if (check.status !== 404)
        throw Error("Drive lookup failed (" + check.status + ")");
    } else {
      const res = await this.request(base + "/generateIds?count=1", {
        headers,
      });
      if (!res.ok)
        throw Error("Could not reserve Drive file (" + res.status + ")");
      driveId = (await res.json()).ids[0];
      db.prepare("INSERT INTO upload_ids VALUES(?,?)").run(id, driveId);
    }
    const file = this.library.file(id),
      size = fs.statSync(file).size;
    const init = await this.request(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "X-Upload-Content-Length": String(size),
          "X-Upload-Content-Type": "video/webm",
        },
        body: JSON.stringify({
          id: driveId,
          name: "glint " + video.created + ".webm",
          parents: [video.folder],
        }),
      },
    );
    if (!init.ok)
      throw Error("Could not start Drive upload (" + init.status + ")");
    const location = new URL(init.headers.get("location"));
    if (
      location.protocol !== "https:" ||
      !location.hostname.endsWith(".googleapis.com")
    )
      throw Error("Invalid Drive upload URL");
    const res = await this.request(location, {
      method: "PUT",
      body: fs.createReadStream(file),
      duplex: "half",
      headers: { "Content-Type": "video/webm", "Content-Length": String(size) },
    });
    if (!res.ok)
      throw Error(
        "Upload interrupted (" +
          res.status +
          "). Your local recording is saved.",
      );
    return finish();
  }
}
module.exports = { Uploads };
