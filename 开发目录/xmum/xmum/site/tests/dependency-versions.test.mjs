import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));

test("Next.js stays on the current security-fixed release", () => {
  assert.equal(packageJson.dependencies.next, "16.4.3");
  assert.equal(packageJson.devDependencies["eslint-config-next"], "16.4.3");
  assert.equal(lock.packages["node_modules/next"]?.version, "16.4.3");
  assert.equal(lock.packages["node_modules/eslint-config-next"]?.version, "16.4.3");
});

test("security-sensitive transitive dependencies stay on patched versions", () => {
  assert.equal(lock.packages["node_modules/source-map-js"]?.version, "1.2.2");

  const sharpPackages = Object.entries(lock.packages).filter(([path]) => path.endsWith("/sharp"));
  assert.ok(sharpPackages.length > 0);
  assert.ok(sharpPackages.every(([, entry]) => entry.version === "0.35.5"));
  assert.equal(lock.packages["node_modules/sharp"]?.integrity, "sha512-Ywn4OnzGukp7CDMrp08RQ50YKmuwG47brZgIVPTvBaaAfQlRlygrRqSrxdCiL9M+LlzLBiJ68IR1QqvzHyjC7g==");
});

test("development dependencies retain compatible security patches", () => {
  assert.equal(packageJson.devDependencies.vite, "8.1.6");
  assert.equal(lock.packages["node_modules/vite"]?.version, "8.1.6");
  const minimumVersions = {
    "@babel/core": "7.29.7",
    "browserslist": "4.29.5",
    "fast-uri": "3.1.9",
    "fflate": "0.7.5",
    "js-yaml": "4.3.2",
    "zod": "4.6.7",
  };
  for (const [name, minimum] of Object.entries(minimumVersions)) {
    const version = lock.packages[`node_modules/${name}`]?.version;
    assert.ok(version, `${name} 必须保留在锁文件中`);
    assert.equal(
      version.localeCompare(minimum, "en", { numeric: true }) >= 0,
      true,
      `${name} 不得低于安全补丁 ${minimum}`,
    );
  }
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path.endsWith("/brace-expansion")) continue;
    const minimum = entry.version.startsWith("1.") ? "1.1.21" : "5.0.12";
    assert.ok(entry.version.localeCompare(minimum, "en", { numeric: true }) >= 0, path);
  }
});

test("Cloudflare and Vinext use the compatible patched toolchain", () => {
  const versions = {
    "@cloudflare/vite-plugin": "1.66.0",
    "wrangler": "4.154.0",
    "vinext": "1.0.1",
    "@vitejs/plugin-rsc": "0.5.34",
  };
  for (const [name, version] of Object.entries(versions)) {
    assert.equal(packageJson.devDependencies[name], version, name);
    assert.equal(lock.packages[`node_modules/${name}`]?.version, version, name);
  }
  assert.equal(packageJson.overrides.fflate, "0.7.5");
  assert.equal(packageJson.overrides.minimatch, "11.0.1");
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path.endsWith("/fflate")) assert.equal(entry.version, "0.7.5", path);
    if (path.endsWith("/minimatch")) assert.equal(entry.version, "11.0.1", path);
  }
  assert.equal(lock.packages["node_modules/image-size"], undefined);
});
