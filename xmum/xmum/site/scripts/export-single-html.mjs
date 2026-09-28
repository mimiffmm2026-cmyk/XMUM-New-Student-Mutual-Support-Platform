import { readFile, readdir, rm, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "vite";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDirectory, "..");
const clientRoot = path.join(projectRoot, "dist", "client");
const serverEntry = path.join(projectRoot, "dist", "server", "index.js");
const clientEntry = path.join(scriptsDirectory, "single-html-client.tsx");
const outputDirectory = path.join(projectRoot, "export-single");
const outputFile = path.join(outputDirectory, "index.html");

const mimeTypes = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".otf", "font/otf"],
]);

function fail(message) {
  throw new Error(`[single-html] ${message}`);
}

async function requireFile(filePath, description) {
  try {
    const details = await stat(filePath);
    if (!details.isFile()) {
      fail(`${description}不是文件：${filePath}`);
    }
  } catch (error) {
    if (error?.message?.startsWith("[single-html]")) {
      throw error;
    }
    fail(
      `找不到${description}：${filePath}。请先运行 npm run build，或直接运行 npm run export:single。`,
    );
  }
}

function getAttribute(tag, name) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  return match?.[1] ?? match?.[2] ?? null;
}

function resolveClientAsset(reference, baseFile = clientRoot) {
  const cleanReference = reference.split("#", 1)[0].split("?", 1)[0];
  let decodedReference;

  try {
    decodedReference = decodeURIComponent(cleanReference);
  } catch {
    fail(`资源路径无法解码：${reference}`);
  }

  const resolved = decodedReference.startsWith("/")
    ? path.resolve(clientRoot, `.${decodedReference}`)
    : path.resolve(path.dirname(baseFile), decodedReference);
  const relative = path.relative(clientRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`资源超出构建目录：${reference}`);
  }

  return resolved;
}

async function toDataUri(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = mimeTypes.get(extension);
  if (!mimeType) {
    fail(`无法判断资源 MIME 类型：${filePath}`);
  }
  const contents = await readFile(filePath);
  return `data:${mimeType};base64,${contents.toString("base64")}`;
}

async function inlineCssResources(css, cssFile) {
  const urlPattern =
    /url\(\s*(?:(["'])(.*?)\1|([^)"']+))\s*\)/gi;
  let output = "";
  let cursor = 0;

  for (const match of css.matchAll(urlPattern)) {
    output += css.slice(cursor, match.index);
    const reference = (match[2] ?? match[3] ?? "").trim();

    if (
      reference === "" ||
      reference.startsWith("data:") ||
      reference.startsWith("http:") ||
      reference.startsWith("https:") ||
      reference.startsWith("#")
    ) {
      output += match[0];
    } else {
      const assetFile = resolveClientAsset(reference, cssFile);
      await requireFile(assetFile, "CSS 引用的本地资源");
      output += `url("${await toDataUri(assetFile)}")`;
    }
    cursor = match.index + match[0].length;
  }

  return output + css.slice(cursor);
}

async function inlineImageSources(html) {
  const imgPattern = /<img\b[^>]*>/gi;
  let output = "";
  let cursor = 0;

  for (const match of html.matchAll(imgPattern)) {
    output += html.slice(cursor, match.index);
    const tag = match[0];
    const src = getAttribute(tag, "src");

    if (!src || src.startsWith("data:") || /^(?:https?:)?\/\//i.test(src)) {
      output += tag;
    } else {
      const assetFile = resolveClientAsset(src);
      await requireFile(assetFile, "图片引用的本地资源");
      output += tag.replace(
        /(\bsrc\s*=\s*)(?:"[^"]*"|'[^']*')/i,
        `$1"${await toDataUri(assetFile)}"`,
      );
    }
    cursor = match.index + tag.length;
  }

  return output + html.slice(cursor);
}

async function inlineClientImageReferences(code) {
  const referencePattern = /["'`](\/images\/[^"'`]+)["'`]/g;
  const cache = new Map();
  let output = "";
  let cursor = 0;

  for (const match of code.matchAll(referencePattern)) {
    const reference = match[1];
    if (!cache.has(reference)) {
      const assetFile = resolveClientAsset(reference);
      await requireFile(assetFile, "客户端脚本引用的本地资源");
      cache.set(reference, await toDataUri(assetFile));
    }
    output += code.slice(cursor, match.index);
    output += `"${cache.get(reference)}"`;
    cursor = match.index + match[0].length;
  }

  return output + code.slice(cursor);
}

async function renderProductionHtml() {
  await requireFile(serverEntry, "生产服务端入口");
  const entryDetails = await stat(serverEntry);
  const moduleUrl = `${pathToFileURL(serverEntry).href}?mtime=${entryDetails.mtimeMs}`;
  const workerModule = await import(moduleUrl);

  if (typeof workerModule.default?.fetch !== "function") {
    fail(`生产服务端入口没有可调用的 fetch()：${serverEntry}`);
  }

  const pendingTasks = [];
  const executionContext = {
    passThroughOnException() {},
    waitUntil(task) {
      pendingTasks.push(Promise.resolve(task));
    },
  };
  const response = await workerModule.default.fetch(
    new Request("https://single-html.local/"),
    {},
    executionContext,
  );

  if (!response.ok) {
    fail(`生产页面渲染失败：HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    fail(`生产页面返回了非 HTML 内容：${contentType || "未知类型"}`);
  }

  const html = await response.text();
  await Promise.allSettled(pendingTasks);
  if (!html.includes("<main")) {
    fail("生产页面缺少 <main>，拒绝生成不完整的单文件。");
  }
  return html;
}

async function collectInlineCss(html) {
  const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map(
    (match) => match[0],
  );
  const stylesheetTags = linkTags.filter(
    (tag) => getAttribute(tag, "rel")?.toLowerCase() === "stylesheet",
  );

  if (stylesheetTags.length === 0) {
    fail("生产 HTML 中没有找到本地样式表。");
  }

  const styles = [];
  for (const tag of stylesheetTags) {
    const href = getAttribute(tag, "href");
    if (!href) {
      fail(`样式表标签缺少 href：${tag}`);
    }
    if (/^(?:https?:)?\/\//i.test(href)) {
      fail(`单文件导出不接受外部样式表：${href}`);
    }
    const cssFile = resolveClientAsset(href);
    await requireFile(cssFile, "生产样式表");
    const css = await readFile(cssFile, "utf8");
    styles.push(await inlineCssResources(css, cssFile));
  }

  return styles.join("\n");
}

async function bundleStandaloneClient() {
  await requireFile(clientEntry, "单文件客户端入口");
  const result = await build({
    root: projectRoot,
    configFile: false,
    logLevel: "error",
    build: {
      cssCodeSplit: false,
      emptyOutDir: false,
      minify: true,
      target: "es2020",
      write: false,
      rollupOptions: {
        input: clientEntry,
        output: {
          format: "es",
          codeSplitting: false,
        },
      },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunks = outputs.flatMap((buildOutput) => buildOutput.output);
  const entryChunks = chunks.filter(
    (item) => item.type === "chunk" && item.isEntry,
  );
  const emittedAssets = chunks.filter((item) => item.type === "asset");

  if (entryChunks.length !== 1) {
    fail(`客户端打包应生成 1 个入口脚本，实际为 ${entryChunks.length} 个。`);
  }
  if (emittedAssets.length > 0) {
    fail(
      `客户端打包仍生成 ${emittedAssets.length} 个外部资源，无法保证只有一个 HTML。`,
    );
  }

  return entryChunks[0].code;
}

function stripFrameworkResources(html) {
  const withoutScripts = html.replace(
    /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,
    "",
  );
  return withoutScripts.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = getAttribute(tag, "rel")?.toLowerCase();
    return rel === "stylesheet" || rel === "modulepreload" ? "" : tag;
  });
}

function assembleSingleHtml(html, css, clientJavaScript) {
  const safeCss = css.replaceAll("</style", "<\\/style");
  const safeJavaScript = clientJavaScript.replaceAll("</script", "<\\/script");
  let output = stripFrameworkResources(html);

  if (!output.includes("</head>") || !output.includes("</body>")) {
    fail("生产 HTML 缺少 </head> 或 </body>，无法安全插入内联资源。");
  }

  output = output.replace(
    "</head>",
    () => `<style data-single-html="styles">${safeCss}</style></head>`,
  );
  output = output.replace(
    "</body>",
    () =>
      `<script type="module" data-single-html="client">${safeJavaScript}</script></body>`,
  );
  return `${output.trim()}\n`;
}

async function verifyOutputDirectory() {
  const files = await readdir(outputDirectory, { recursive: true });
  if (files.length !== 1 || files[0] !== "index.html") {
    fail(
      `导出目录必须只有 index.html，实际包含：${files.join(", ") || "空目录"}`,
    );
  }
}

async function main() {
  const html = await inlineImageSources(await renderProductionHtml());
  const [css, clientJavaScript] = await Promise.all([
    collectInlineCss(html),
    bundleStandaloneClient(),
  ]);
  const singleHtml = assembleSingleHtml(
    html,
    css,
    await inlineClientImageReferences(clientJavaScript),
  );

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputFile, singleHtml, "utf8");
  await verifyOutputDirectory();

  const outputDetails = await stat(outputFile);
  const sizeMiB = (outputDetails.size / 1024 / 1024).toFixed(2);
  console.log(
    `[single-html] 已生成 ${path.relative(projectRoot, outputFile)}（${sizeMiB} MiB）`,
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : `[single-html] ${String(error)}`,
  );
  process.exitCode = 1;
});
