const fs = require("node:fs");
const path = require("node:path");

const keys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_PICKER_KEY", "GOOGLE_PROJECT_NUMBER"];
const filename = "google-desktop.json";

function missing(config) {
  return keys.filter(key => !config[key]?.trim());
}

function publisherConfig(env) {
  const absent = missing(env);
  if (absent.length) throw Error("Missing release settings: " + absent.join(", "));
  return Object.fromEntries(keys.map(key => [key, env[key].trim()]));
}

function loadConfig(appDir, env = process.env) {
  // Never mix settings from two different Google Cloud projects.
  if (keys.some(key => env[key]?.trim())) return env;
  const file = path.join(appDir, filename);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

module.exports = { filename, missing, publisherConfig, loadConfig };
