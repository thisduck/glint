const http = require("node:http"),
  crypto = require("node:crypto");
const fs = require("node:fs");
const tokenUrl = "https://oauth2.googleapis.com/token";
const files = "https://www.googleapis.com/drive/v3/files";
const driveScope = "https://www.googleapis.com/auth/drive.file";
const reconnectMessage =
  "Open Manage accounts and choose Reconnect for this account. On Google's consent screen, select the permission to access the Drive files you use with glint, then continue.";
const random = () => crypto.randomBytes(32).toString("base64url");
async function json(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (
      res.status === 403 &&
      (data.error?.details?.some(
        (detail) => detail.reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
      ) ||
        /insufficient authentication scopes/i.test(data.error?.message || ""))
    ) {
      throw Error(reconnectMessage);
    }
    if (data.error === "invalid_grant") throw Error(reconnectMessage);
    throw Error(
      data.error_description ||
        data.error?.message ||
        "Google request failed (" + res.status + ")",
    );
  }
  if (res.status === 204 || options?.method === "DELETE") return null;
  return res.json();
}
async function browserSession(open, setup) {
  const server = http.createServer(),
    nonce = random();
  let timer;
  try {
    await new Promise((ok, no) => {
      server.once("error", no);
      server.listen(0, "127.0.0.1", ok);
    });
    const origin = "http://127.0.0.1:" + server.address().port;
    return await new Promise((ok, no) => {
      timer = setTimeout(
        () => no(Error("Google connection timed out. Please try again.")),
        180000,
      );
      const flow = setup(origin, nonce);
      server.on("request", async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Referrer-Policy", "no-referrer");
        if (req.headers.host !== new URL(origin).host) {
          res.writeHead(403).end();
          return;
        }
        try {
          await flow.request(new URL(req.url, origin), req, res, ok);
        } catch (e) {
          res.writeHead(400).end("Return to glint and try again.");
          no(e);
        }
      });
      open(flow.url).catch(no);
    });
  } finally {
    clearTimeout(timer);
    server.close();
    server.closeAllConnections();
  }
}
class Google {
  constructor(store, secure, open, config = process.env) {
    this.db = store.db;
    this.secure = secure;
    this.open = open;
    this.config = config;
  }
  credentials() {
    const { GOOGLE_CLIENT_ID: client_id, GOOGLE_CLIENT_SECRET: client_secret } =
      this.config;
    if (!client_id || !client_secret)
      throw Error(
        "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for the desktop OAuth client. See README.",
      );
    return { client_id, client_secret };
  }
  async token(params) {
    const tokens = await json(tokenUrl, {
      method: "POST",
      body: new URLSearchParams({ ...this.credentials(), ...params }),
    });
    // An omitted scope means the grant is unchanged. Drive errors still
    // identify insufficient permissions on previously stored grants.
    if (
      typeof tokens.scope === "string" &&
      !tokens.scope.split(/\s+/).includes(driveScope)
    )
      throw Error(reconnectMessage);
    return tokens;
  }
  accounts() {
    return this.db
      .prepare("SELECT id,email FROM accounts ORDER BY email")
      .all();
  }
  disconnect(account) {
    this.db.exec("BEGIN");
    try {
      this.db.prepare("DELETE FROM accounts WHERE id=?").run(account);
      this.db
        .prepare(
          "UPDATE profiles SET account=NULL, folder=NULL, folderName=NULL, autoUpload=0 WHERE account=?",
        )
        .run(account);
      this.db
        .prepare(
          "UPDATE videos SET uploadState='failed' WHERE account=? AND uploadState='pending'",
        )
        .run(account);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  async connect(account) {
    const existing =
      account && this.accounts().find((row) => row.id === account);
    if (account && !existing)
      throw Error("This account has been disconnected.");
    const { client_id } = this.credentials(),
      verifier = random();
    const result = await browserSession(this.open, (origin, state) => {
      const redirect_uri = origin + "/callback";
      const params = new URLSearchParams({
        client_id,
        redirect_uri,
        ...(existing && { login_hint: existing.email }),
        response_type: "code",
        state,
        scope: "openid email " + driveScope,
        access_type: "offline",
        prompt: "select_account consent",
        code_challenge_method: "S256",
        code_challenge: crypto
          .createHash("sha256")
          .update(verifier)
          .digest("base64url"),
      });
      return {
        url: "https://accounts.google.com/o/oauth2/v2/auth?" + params,
        request: (url, req, res, ok) => {
          if (
            url.pathname != "/callback" ||
            url.searchParams.get("state") !== state
          ) {
            res.writeHead(404).end();
            return;
          }
          const code = url.searchParams.get("code");
          if (!code) throw Error("Google sign-in was cancelled.");
          const page = fs.readFileSync(
            require("node:path").join(__dirname, "google-return.html"),
          );
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
          });
          res.end(page, () => ok({ code, redirect_uri }));
        },
      };
    });
    const tokens = await this.token({
      ...result,
      code_verifier: verifier,
      grant_type: "authorization_code",
    });
    const user = await json(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: "Bearer " + tokens.access_token } },
    );
    if (existing && existing.id !== user.sub)
      throw Error("Choose " + existing.email + " to reconnect this account.");
    if (!tokens.refresh_token)
      throw Error("Reconnect and grant offline access.");
    this.db
      .prepare("INSERT OR REPLACE INTO accounts VALUES(?,?,?)")
      .run(
        user.sub,
        user.email,
        this.secure.encryptString(tokens.refresh_token),
      );
    return user.sub;
  }
  async access(account) {
    const row = this.db
      .prepare("SELECT token FROM accounts WHERE id=?")
      .get(account);
    if (!row) throw Error("Connect this Google account first.");
    const token = await this.token({
      refresh_token: this.secure.decryptString(Buffer.from(row.token)),
      grant_type: "refresh_token",
    });
    return token.access_token;
  }
  async fileInfo(id, headers) {
    return json(
      files +
        "/" +
        encodeURIComponent(id) +
        "?supportsAllDrives=true&fields=webViewLink,ownedByMe,permissions(type,role,allowFileDiscovery,deleted,view),videoMediaMetadata",
      { headers },
    );
  }
  async filePermissions(id, headers) {
    const grants = [];
    let pageToken;
    do {
      const query = new URLSearchParams({
        supportsAllDrives: "true",
        fields:
          "nextPageToken,permissions(id,type,role,allowFileDiscovery,deleted,view,permissionDetails(inherited))",
        pageSize: "100",
      });
      if (pageToken) query.set("pageToken", pageToken);
      const result = await json(
        files + "/" + encodeURIComponent(id) + "/permissions?" + query,
        { headers },
      );
      grants.push(...(result.permissions || []));
      pageToken = result.nextPageToken;
    } while (pageToken);
    return grants;
  }
  async trashFile(id,account) {
    const token = await this.access(account);
    return json(files+"/"+encodeURIComponent(id)+"?supportsAllDrives=true&fields=trashed",{
      method:"PATCH",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({trashed:true})
    });
  }
  async changeLink(id, headers, enabled) {
    const grants = (await this.filePermissions(id,headers)).filter(p=>p.type==="anyone" && !p.deleted && !p.view);
    if (enabled && !grants.length) return this.enableLink(id,headers);
    const changes = grants.filter(p=>!enabled || p.allowFileDiscovery || p.role !== "reader");
    if(changes.some(p=>p.permissionDetails?.some(detail=>detail.inherited))) throw Error("This link access comes from the containing folder. Change its sharing in Drive.");
    for (const p of changes) {
      const url=files+"/"+encodeURIComponent(id)+"/permissions/"+encodeURIComponent(p.id)+"?supportsAllDrives=true";
      await json(url,enabled ? {method:"PATCH",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({role:"reader",allowFileDiscovery:false})} : {method:"DELETE",headers});
    }
  }
  async enableLink(id, headers) {
    return json(
      files +
        "/" +
        encodeURIComponent(id) +
        "/permissions?supportsAllDrives=true",
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "anyone",
          role: "reader",
          allowFileDiscovery: false,
        }),
      },
    );
  }
  async recordingsFolder(profile, account) {
    const row = this.db
      .prepare("SELECT name FROM profiles WHERE id=?")
      .get(profile);
    if (!row) throw Error("Choose a profile first.");
    const token = await this.access(account);
    const headers = { Authorization: "Bearer " + token };
    // Reserve the Drive ID locally before creation so a retry after a lost
    // response uses the same folder. Different accounts have separate IDs.
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS recordings_folders(profile INTEGER NOT NULL, account TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY(profile, account))",
    );
    const lookup = this.db.prepare(
      "SELECT id FROM recordings_folders WHERE profile=? AND account=?",
    );
    let entry = lookup.get(profile, account);
    if (!entry) {
      const result = await json(files + "/generateIds?count=1", { headers });
      this.db
        .prepare("INSERT OR IGNORE INTO recordings_folders VALUES(?,?,?)")
        .run(profile, account, result.ids[0]);
      entry = lookup.get(profile, account);
    }
    const fields = "id,name,mimeType,trashed,capabilities(canAddChildren)";
    const url =
      files + "/" + encodeURIComponent(entry.id) + "?fields=" + fields;
    let response = await fetch(url, { headers });
    if (response.status === 404) {
      response = await fetch(files + "?fields=" + fields, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry.id,
          name: "glint – " + row.name,
          mimeType: "application/vnd.google-apps.folder",
        }),
      });
      if (response.status === 409) response = await fetch(url, { headers });
    }
    const info = await response.json();
    if (!response.ok)
      throw Error(
        info.error?.message ||
          "Could not open the recordings folder (" + response.status + ").",
      );
    if (info.trashed)
      throw Error(
        "Restore this profile’s glint folder from Drive Trash, then try again.",
      );
    this.saveDestination(profile, account, info);
  }
  async folder(profile, account) {
    const { GOOGLE_PICKER_KEY: key, GOOGLE_PROJECT_NUMBER: project } =
      this.config;
    if (!key || !project)
      throw Error(
        "Set GOOGLE_PICKER_KEY and GOOGLE_PROJECT_NUMBER to enable folder selection. See README.",
      );
    const token = await this.access(account);
    const id = await browserSession(this.open, (origin, nonce) => {
      const page = "/pick/" + nonce;
      return {
        url: origin + page,
        request: async (url, req, res, ok) => {
          if (url.pathname !== page) {
            res.writeHead(404).end();
            return;
          }
          if (req.method === "POST") {
            if (req.headers.origin !== origin) {
              res.writeHead(403).end();
              return;
            }
            const selected = url.searchParams.get("id");
            if (!selected) throw Error("Folder selection cancelled.");
            res.end("Saved", () => ok(selected));
            return;
          }
          const args = JSON.stringify({ key, project, token }).replaceAll(
            "<",
            "\\u003c",
          );
          // Picker embeds docs.google.com. Send the loopback origin, while
          // keeping the session-specific URL path out of cross-origin requests.
          res.setHeader("Referrer-Policy", "origin");
          res.setHeader("Content-Type", "text/html;charset=utf-8");
          const pageHtml = fs.readFileSync(
            require("node:path").join(__dirname, "google-picker.html"),
            "utf8",
          );
          res.end(
            pageHtml.replace("/* GOOGLE_CONFIGURATION */ null", () => args),
          );
        },
      };
    });
    const info = await json(
      files +
        "/" +
        encodeURIComponent(id) +
        "?supportsAllDrives=true&fields=id,name,mimeType,capabilities(canAddChildren)",
      { headers: { Authorization: "Bearer " + token } },
    );
    this.saveDestination(profile, account, info);
  }
  saveDestination(profile, account, info) {
    if (
      info.mimeType !== "application/vnd.google-apps.folder" ||
      !info.capabilities?.canAddChildren
    )
      throw Error("Choose a folder you can upload to.");
    this.db
      .prepare("UPDATE profiles SET account=?,folder=?,folderName=? WHERE id=?")
      .run(account, info.id, info.name, profile);
  }
}
module.exports = { Google, json };
