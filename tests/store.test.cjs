const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { Store } = require("../src/store.cjs");
test("profiles survive restart with renamed defaults and additional profiles", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snow-white-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const file = path.join(dir, "library"),
    s = new Store(file);
  assert.deepEqual(
    s.profiles().map((p) => p.name),
    ["Work", "Personal"],
  );
  s.save("Studio", 1);
  s.save("Client");
  assert.throws(() => s.save("  "));
  s.db.close();
  const again = new Store(file);
  assert.deepEqual(
    again.profiles().map((p) => p.name),
    ["Studio", "Personal", "Client"],
  );
  again.db.close();
});
