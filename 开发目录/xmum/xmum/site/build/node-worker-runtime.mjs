import { register } from "node:module";

let registered = false;

// Node-only adapter for inspecting built Worker output and exporting offline HTML.
// Optional Workers tracing is absent; attempts to use real bindings must fail.
export function loadBuiltWorker(moduleUrl) {
  if (!registered) {
    const stubUrl = `data:text/javascript,${encodeURIComponent(`
      export const tracing = undefined;
      function unavailable() {
        throw new Error("Cloudflare bindings are unavailable in Node build checks.");
      }
      const bindings = new Proxy(Object.create(null), {
        get: unavailable,
        has: unavailable,
        ownKeys: unavailable,
        getOwnPropertyDescriptor: unavailable,
      });
      export const env = bindings;
      export const exports = bindings;
      export const cache = bindings;
      export const waitUntil = unavailable;
    `)}`;
    const loaderUrl = `data:text/javascript,${encodeURIComponent(`
      export async function resolve(specifier, context, nextResolve) {
        if (specifier === "cloudflare:workers") {
          return { shortCircuit: true, url: ${JSON.stringify(stubUrl)} };
        }
        return nextResolve(specifier, context);
      }
    `)}`;
    register(loaderUrl, import.meta.url);
    registered = true;
  }
  return import(moduleUrl instanceof URL ? moduleUrl.href : moduleUrl);
}
