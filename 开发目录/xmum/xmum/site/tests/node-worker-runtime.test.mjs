import assert from "node:assert/strict";
import test from "node:test";
import { loadBuiltWorker } from "../build/node-worker-runtime.mjs";

test("Node build checks omit optional tracing but refuse Cloudflare binding access", async () => {
  const namespace = await loadBuiltWorker(
    `data:text/javascript,${encodeURIComponent('export * from "cloudflare:workers";')}`,
  );
  assert.equal(namespace.tracing, undefined);
  for (const name of ["env", "exports", "cache"]) {
    assert.throws(() => namespace[name].example, /Cloudflare bindings are unavailable/);
    assert.throws(() => "example" in namespace[name], /Cloudflare bindings are unavailable/);
    assert.throws(() => Object.keys(namespace[name]), /Cloudflare bindings are unavailable/);
  }
  assert.throws(() => namespace.waitUntil(Promise.resolve()), /Cloudflare bindings are unavailable/);
});

test("Node Worker adapter preserves ordinary module loading and unknown-scheme failures", async () => {
  const namespace = await loadBuiltWorker("node:path");
  assert.equal(typeof namespace.join, "function");
  await assert.rejects(
    loadBuiltWorker("unsupported-worker-runtime:example"),
    { code: "ERR_UNSUPPORTED_ESM_URL_SCHEME" },
  );
});
