const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { appUpdates } = require("../src/app-updates.cjs");

function setup(t, enabled = true) {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  const updater = new EventEmitter();
  updater.setFeedURL = t.mock.fn();
  updater.checkForUpdates = t.mock.fn();
  updater.quitAndInstall = t.mock.fn();
  let busy = true;
  const beforeInstall = t.mock.fn();
  const controller = appUpdates({
    updater, version: "1.0.0", preferences: { read: () => enabled, write: value => { enabled = value; } },
    busy: () => busy, beforeInstall, onChange() {},
  });
  t.after(controller.close);
  return { updater, rows: controller.rows, finish: () => { busy = false; }, beforeInstall, enabled: () => enabled };
}

test("scheduled and manual checks share a download, and restarting waits for active work", t => {
  const app = setup(t);
  t.mock.timers.tick(5000);
  app.rows()[1].apply();
  assert.equal(app.updater.checkForUpdates.mock.callCount(), 1);
  app.updater.emit("update-available");
  assert.equal(app.rows()[1].disabled, true);
  app.updater.emit("update-downloaded");
  assert.equal(app.rows()[1].label, "Update and restart");
  app.rows()[1].apply();
  assert.equal(app.updater.quitAndInstall.mock.callCount(), 0);
  app.finish();
  app.rows()[1].apply();
  assert.equal(app.beforeInstall.mock.callCount(), 1);
  assert.equal(app.updater.quitAndInstall.mock.callCount(), 1);
});

test("automatic checks honor the saved preference and manual checks still work", t => {
  const app = setup(t, false);
  t.mock.timers.tick(4 * 60 * 60 * 1000);
  assert.equal(app.updater.checkForUpdates.mock.callCount(), 0);
  app.rows()[1].apply();
  app.updater.emit("update-not-available");
  assert.match(app.rows()[1].label, /Up to date/);
  app.rows()[0].apply(true);
  assert.equal(app.enabled(), true);
  assert.equal(app.updater.checkForUpdates.mock.callCount(), 2);
});
