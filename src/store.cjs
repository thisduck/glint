const { DatabaseSync } = require("node:sqlite");
class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, account TEXT, folder TEXT, folderName TEXT);
      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL, token BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS videos (id TEXT PRIMARY KEY, profile INTEGER NOT NULL REFERENCES profiles(id),
      created TEXT NOT NULL, account TEXT, folder TEXT, remote TEXT, ready INTEGER DEFAULT 0);
      INSERT INTO profiles(name)
      SELECT name FROM (SELECT 'Work' AS name UNION ALL SELECT 'Personal')
      WHERE NOT EXISTS (SELECT 1 FROM profiles);`);
    if (
      !this.db
        .prepare("PRAGMA table_info(profiles)")
        .all()
        .some((c) => c.name === "autoUpload")
    )
      this.db.exec(
        "ALTER TABLE profiles ADD COLUMN autoUpload INTEGER NOT NULL DEFAULT 0",
      );
    if (
      !this.db
        .prepare("PRAGMA table_info(videos)")
        .all()
        .some((c) => c.name === "uploadState")
    )
      this.db.exec("ALTER TABLE videos ADD COLUMN uploadState TEXT");
  }
  setAutoUpload(profile, enabled) {
    if (typeof enabled !== "boolean")
      throw Error("Invalid auto-upload setting");
    const result = this.db
      .prepare(
        "UPDATE profiles SET autoUpload=? WHERE id=? AND (?=0 OR (account IS NOT NULL AND folder IS NOT NULL))",
      )
      .run(Number(enabled), profile, Number(enabled));
    if (!result.changes)
      throw Error("Choose a Drive account and folder first.");
  }
  profiles() {
    return this.db.prepare("SELECT * FROM profiles ORDER BY id").all();
  }
  save(name, id) {
    name = name.trim();
    if (!name || name.length > 100)
      throw Error("Use a profile name between 1 and 100 characters.");
    if (id)
      this.db.prepare("UPDATE profiles SET name=? WHERE id=?").run(name, id);
    else
      return Number(
        this.db.prepare("INSERT INTO profiles(name) VALUES(?)").run(name)
          .lastInsertRowid,
      );
    return id;
  }
}
module.exports = { Store };
