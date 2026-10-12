import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));

test("security-sensitive transitive dependencies stay on patched versions", () => {
  assert.equal(lock.packages["node_modules/source-map-js"]?.version, "1.2.2");

  const sharpPackages = Object.entries(lock.packages).filter(([path]) => path.endsWith("/sharp"));
  assert.ok(sharpPackages.length > 0);
  assert.ok(sharpPackages.every(([, entry]) => entry.version === "0.35.5"));
  assert.equal(lock.packages["node_modules/sharp"]?.integrity, "sha512-Ywn4OnzGukp7CDMrp08RQ50YKmuwG47brZgIVPTvBaaAfQlRlygrRqSrxdCiL9M+LlzLBiJ68IR1QqvzHyjC7g==");
});
