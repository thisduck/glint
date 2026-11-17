const fs = require("node:fs");
class Uploads {
  constructor(library, google, request = fetch) {
    this.library = library;
    this.google = google;
    this.request = request;
    this.busy = new Set();
    this.progress = new Map();
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
            "SELECT id FROM videos WHERE ready=1 AND uploadState='pending' ORDER BY created",
          )
          .all()
          .find((row) => !this.busy.has(row.id));
        if (!next) break;
        // send records failures against the video so the queue can continue.
        await this.send(next.id).catch(() => {});
      }
    } finally {
      this.draining = false;
    }
  }
  async send(id) {
    if (this.busy.has(id)) throw Error("Upload already running");
    this.busy.add(id);
    try {
      this.library.db
        .prepare(
          "UPDATE videos SET uploadState='pending',uploadError=NULL WHERE id=? AND ready=1 AND (remote IS NULL OR uploadState IS NOT NULL)",
        )
        .run(id);
      return await this.upload(id);
    } catch (error) {
      this.library.db
        .prepare(
          "UPDATE videos SET uploadState='failed',uploadError=? WHERE id=?",
        )
        .run(error.message, id);
      throw error;
    } finally {
      this.busy.delete(id);
      this.progress.delete(id);
    }
  }
  async upload(id) {
    const { db } = this.library;
    const video = db
      .prepare("SELECT * FROM videos WHERE id=? AND ready=1")
      .get(id);
    if (!video) throw Error("Recording unavailable");
    if (video.remote && !video.uploadState) return video.remote;
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
    const finish = async () => {
      if (video.privacy === "link") {
        db.prepare(
          "UPDATE videos SET remote=?,uploadState='pending' WHERE id=?",
        ).run(driveId, id);
        await this.google.enableLink(driveId, headers);
      }
      db.prepare(
        "UPDATE videos SET remote=?,uploadState=NULL,uploadError=NULL WHERE id=?",
      ).run(driveId, id);
      return driveId;
    };
    if (video.remote) {
      driveId = video.remote;
      return finish();
    }
    if (video.privacy === "private") {
      const folder = await this.google.fileInfo(video.folder, headers);
      const active = folder.permissions?.filter((p) => !p.deleted);
      if (
        !folder.ownedByMe ||
        !active?.length ||
        !active.every((p) => p.role === "owner")
      )
        throw Error(
          "Private upload needs a folder only you can access. Review this folder’s sharing in Drive, then retry.",
        );
    }
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
          name: (video.title || "glint " + video.created) + ".webm",
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
    const input = fs.createReadStream(file);
    const progress = this.progress;
    async function* body() {
      let sent = 0;
      for await (const chunk of input) {
        yield chunk;
        sent += chunk.length;
        progress.set(id, Math.min(99, Math.floor((sent * 100) / size)));
      }
    }
    this.progress.set(id, 0);
    let res;
    try {
      res = await this.request(location, {
        method: "PUT",
        body: body(),
        duplex: "half",
        headers: {
          "Content-Type": "video/webm",
          "Content-Length": String(size),
        },
      });
    } finally {
      input.destroy();
    }
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
