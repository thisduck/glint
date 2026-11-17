const { test } = require("node:test");
const assert = require("node:assert/strict");
const { describeAccess } = require("../src/drive-status.cjs");
test("Drive access reflects effective grants, with an unknown state for missing permission data", () => {
  assert.equal(describeAccess({}), "Access unavailable");
  for (const [grant, label] of [
    [{ role: "owner" }, "Private · only you"],
    [{ type: "user", role: "reader" }, "Specific people or groups"],
    [{ type: "domain" }, "Organization access"],
    [{ type: "anyone" }, "Anyone with the link"],
    [{ type: "anyone", allowFileDiscovery: true }, "Public on the web"],
  ])
    assert.equal(
      describeAccess({ ownedByMe: true, permissions: [grant] }),
      label,
    );
});
