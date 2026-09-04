import assert from "node:assert/strict";
import test from "node:test";

import { nextPatch } from "../src/version.js";

test("each commit advances the extension patch version", () => {
  assert.equal(nextPatch("1.4.0"), "1.4.1");
  assert.equal(nextPatch("2.9.99"), "2.9.100");
  assert.throws(() => nextPatch("1.4"), /major\.minor\.patch/);
});
