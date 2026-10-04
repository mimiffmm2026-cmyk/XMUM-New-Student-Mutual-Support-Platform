import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PDFDict, PDFDocument, PDFName, PDFStream } from "pdf-lib";

const execFileAsync = promisify(execFile);

test("synthetic adversarial PDFs cover every compression safety gate", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "xmum-pdf-safety-fixtures-"),
  );
  try {
    await execFileAsync(process.execPath, [
      fileURLToPath(new URL("./create-adversarial-pdf-fixtures.mjs", import.meta.url)),
      directory,
    ]);

    const load = async (name) =>
      PDFDocument.load(await readFile(path.join(directory, name)), {
        ignoreEncryption: false,
        updateMetadata: false,
      });

    const passportCrop = await load("passport-cropbox-media-content.pdf");
    assert.equal(passportCrop.getPageCount(), 3);
    assert.notDeepEqual(
      passportCrop.getPage(0).getCropBox(),
      passportCrop.getPage(0).getMediaBox(),
    );
    assert.ok(
      (await stat(path.join(directory, "passport-cropbox-media-content.pdf")))
        .size > 2_900_000,
    );

    const healthCrop = await load("health-cropbox-media-content.pdf");
    assert.notDeepEqual(
      healthCrop.getPage(1).getCropBox(),
      healthCrop.getPage(1).getMediaBox(),
    );

    const form = await load("health-acroform-widget.pdf");
    assert.ok(form.getForm().getFields().length > 0);
    assert.ok(form.getPages().some((page) => (page.node.Annots()?.size() ?? 0) > 0));

    const annotation = await load("health-page-annotation.pdf");
    assert.ok((annotation.getPage(0).node.Annots()?.size() ?? 0) > 0);

    const signature = await load("health-digital-signature-field.pdf");
    const signatureObjects = signature.context
      .enumerateIndirectObjects()
      .filter(([, object]) => {
        const dictionary =
          object instanceof PDFStream
            ? object.dict
            : object instanceof PDFDict
              ? object
              : undefined;
        return (
          dictionary
            ?.lookupMaybe(PDFName.of("FT"), PDFName)
            ?.asString() === "/Sig"
        );
      });
    assert.ok(signatureObjects.length > 0);

    assert.equal(
      (await load("passport-page-limit.pdf")).getPageCount(),
      41,
    );
    assert.equal((await load("health-page-limit.pdf")).getPageCount(), 25);
    assert.ok(
      (await load("health-pixel-limit.pdf")).getPage(0).getWidth() > 10_000,
    );
    assert.equal((await stat(path.join(directory, "empty.pdf"))).size, 0);
    assert.equal(
      (await stat(path.join(directory, "oversize-input.pdf"))).size,
      45_000_001,
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("compressors retain structural, local-detail, and bounded-memory gates", async () => {
  const [passportSource, healthSource] = await Promise.all([
    readFile(
      new URL("../app/PassportPdfCompressor.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/HealthPdfCompressor.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  const combined = `${passportSource}\n${healthSource}`;

  for (const required of [
    "CropBox 与 MediaBox 不一致",
    "数字签名字段（/Sig）",
    "交互式表单（/AcroForm 或 Widget）",
    "页面批注或附件注释（/Annots）",
    "MAX_LOCAL_TILE_MAE",
    "MAX_HIGH_FREQUENCY_MAE",
    "assertDocumentRenderBudget",
    "encodePagesAtQuality",
    "停止当前处理",
  ]) {
    assert.match(combined, new RegExp(required.replace(/[()/.]/g, "\\$&")));
  }
  assert.doesNotMatch(
    combined,
    /pageVariants\s*=\s*new Map<number,\s*Uint8Array\[\]>/,
    "不得再次按页保留全部 JPEG 质量档",
  );
  assert.doesNotMatch(
    combined,
    /if\s*\(item\.file\.size\s*===\s*0\)\s*\{\s*continue/,
    "空 PDF 不得被静默跳过",
  );
});
