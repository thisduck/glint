const test = require("node:test"),
  assert = require("node:assert/strict");
test("camera bubble fits landscape and portrait captures in all four corners", async () => {
  const { bubbleBounds } = await import("../src/camera.mjs");
  for (const [width, height] of [
    [1920, 1080],
    [720, 1280],
  ])
    for (const x of [0, 1])
      for (const y of [0, 1]) {
        const b = bubbleBounds(width, height, { x, y });
        assert.ok(
          b.x > 0 && b.y > 0 && b.x + b.size < width && b.y + b.size < height,
        );
        assert.equal(b.x > width / 2, !!x);
        assert.equal(b.y > height / 2, !!y);
      }
});

test("camera diameter changes without pushing the bubble beyond the recorded edges", async () => {
  const { bubbleBounds } = await import("../src/camera.mjs");
  for (const [scale, diameter] of [
    [0.1, 100],
    [0.36, 360],
    [0.48, 480],
  ]) {
    const box = bubbleBounds(1600, 1000, { x: 1, y: 1, scale });
    assert.equal(box.size, diameter);
    assert.equal(box.x + box.size, 1575);
    assert.equal(box.y + box.size, 975);
  }
});
