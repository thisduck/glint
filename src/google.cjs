const http = require("node:http"),
  crypto = require("node:crypto");
const fs = require("node:fs");
const tokenUrl = "https://oauth2.googleapis.com/token";
const files = "https://www.googleapis.com/drive/v3/files";
const random = () => crypto.randomBytes(32).toString("base64url");
async function json(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Error(
      data.error_description ||
        data.error?.message ||
        "Google request failed (" + res.status + ")",
    );
  }
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
          res.writeHead(400).end("Return to cinderella and try again.");
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
    return json(tokenUrl, {
      method: "POST",
      body: new URLSearchParams({ ...this.credentials(), ...params }),
    });
  }
  accounts() {
    return this.db
      .prepare("SELECT id,email FROM accounts ORDER BY email")
      .all();
  }
  async connect() {
    const { client_id } = this.credentials(),
      verifier = random();
    const result = await browserSession(this.open, (origin, state) => {
      const redirect_uri = origin + "/callback";
      const params = new URLSearchParams({
        client_id,
        redirect_uri,
        response_type: "code",
        state,
        scope: "openid email https://www.googleapis.com/auth/drive.file",
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
          res.end("Return to cinderella to choose your folder.");
          ok({ code, redirect_uri });
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
            res.end("Saved");
            ok(selected);
            return;
          }
          const args = JSON.stringify({ key, project, token }).replaceAll(
            "<",
            "\\u003c",
          );
          res.setHeader("Content-Type", "text/html;charset=utf-8");
          res.end(`<!doctype html><title>Choose a folder · cinderella</title><p>Choose a Google Drive folder for cinderella.</p><script src="https://apis.google.com/js/api.js"></script><script>
        const config=${args};
        gapi.load('picker',()=>{const p=google.picker;
          const view=new p.DocsView(p.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true);
          new p.PickerBuilder().addView(view).setDeveloperKey(config.key).setAppId(config.project)
          .setOAuthToken(config.token).setOrigin(location.origin).setCallback(async data=>{
            if(data.action===p.Action.PICKED||data.action===p.Action.CANCEL){
              await fetch(location.pathname+'?id='+encodeURIComponent(data.docs?.[0]?.id||''),{method:'POST'});
              document.body.textContent='Return to cinderella.';
            }}).build().setVisible(true)
        });</script>`);
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
    if (
      info.mimeType !== "application/vnd.google-apps.folder" ||
      !info.capabilities?.canAddChildren
    )
      throw Error("Choose a folder you can upload to.");
    this.db
      .prepare("UPDATE profiles SET account=?,folder=?,folderName=? WHERE id=?")
      .run(account, id, info.name, profile);
  }
}
module.exports = { Google, json };
