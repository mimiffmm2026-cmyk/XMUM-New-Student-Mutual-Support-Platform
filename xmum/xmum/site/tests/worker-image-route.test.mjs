import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const imagePath = new URL("../public/images/xmum-campus-map.jpg", import.meta.url);
const imageBytes = await readFile(imagePath);

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("image-route-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

function executionContext() {
  return {
    waitUntil() {},
    passThroughOnException() {},
  };
}

function assets() {
  return {
    fetch: async (request) => {
      const { pathname } = new URL(request.url);
      if (pathname !== "/images/xmum-campus-map.jpg") {
        return new Response("Not found", { status: 404 });
      }
      return new Response(imageBytes, {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      });
    },
  };
}

async function fetchImage(query, env = { ASSETS: assets() }) {
  const worker = await loadWorker();
  return worker.fetch(
    new Request(`http://localhost/_vinext/image?${query}`),
    env,
    executionContext(),
  );
}

test("image route serves the original image without IMAGES and without an optimization error", async () => {
  const errors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => errors.push(args.map(String).join(" "));

  let response;
  try {
    response = await fetchImage("url=%2Fimages%2Fxmum-campus-map.jpg&w=640&q=75");
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^image\/jpeg\b/i);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), imageBytes);
  assert.equal(
    errors.filter((message) => message.includes("Image optimization error")).length,
    0,
  );
});

test("image route uses the optional IMAGES binding when it is available", async () => {
  let inputCalls = 0;
  const transformOptions = [];
  const transformedBytes = new TextEncoder().encode("transformed-image");
  const env = {
    ASSETS: assets(),
    IMAGES: {
      input() {
        inputCalls += 1;
        return {
          transform(options) {
            transformOptions.push(options);
            return {
              output: async () => ({
                response: () =>
                  new Response(transformedBytes, {
                    status: 200,
                    headers: { "Content-Type": "image/webp" },
                  }),
              }),
            };
          },
        };
      },
    },
  };

  const response = await fetchImage(
    "url=%2Fimages%2Fxmum-campus-map.jpg&w=640&q=75",
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(inputCalls, 1);
  assert.deepEqual(transformOptions, [{ width: 640 }]);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), transformedBytes);
  assert.match(response.headers.get("content-type") ?? "", /^image\/webp\b/i);
});

test("image route rejects a width outside the configured allowlist", async () => {
  const response = await fetchImage("url=%2Fimages%2Fxmum-campus-map.jpg&w=123&q=75");

  assert.equal(response.status, 400);
});

test("image route returns 404 when the source image is missing", async () => {
  const response = await fetchImage("url=%2Fimages%2Fmissing.jpg&w=640&q=75");

  assert.equal(response.status, 404);
});
