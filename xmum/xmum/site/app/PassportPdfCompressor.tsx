"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { WECHAT_DOWNLOAD_HINT, isWeChatUserAgent } from "./download-hint";
import type {
  PDFDict,
  PDFDocument as PdfLibDocument,
  PDFPage as PdfLibPage,
  PDFStream,
} from "pdf-lib";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist";

const TARGET_BYTES = 2_900_000;
const PROFILE_PAGE_INDEX = 2;
const OUTPUT_SUFFIX = "_压缩_2.9MB内";
const PROFILE_VALIDATION_SCALE = 1.5;
const OTHER_PAGE_VALIDATION_SCALE = 1;
const MAX_RENDER_EDGE = 1_900;
const MAX_RENDER_PIXELS = 3_400_000;
const MAX_OTHER_PAGE_MAE = 22;
const MAX_LOCAL_TILE_MAE = 34;
const MAX_HIGH_FREQUENCY_MAE = 60;
const LOCAL_GRID_SIZE = 8;
const HIGH_FREQUENCY_DELTA = 18;
const MAX_PAGE_EDGE_POINTS = 10_000;
const MAX_PAGE_AREA_POINTS = 24_000_000;
const MAX_PASSPORT_ENCODED_BYTES = 14_000_000;
export const MAX_PASSPORT_INPUT_BYTES = 30_000_000;
export const MAX_PASSPORT_PAGES = 40;
export const MAX_PASSPORT_TOTAL_RENDER_PIXELS = 68_000_000;

export type PdfLibModule = typeof import("pdf-lib");
export type PdfJsModule = typeof import("pdfjs-dist");

export type WritableFileLike = {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
};

export type FileHandleLike = {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableFileLike>;
};

export type DirectoryHandleLike = {
  kind: "directory";
  name: string;
  values(): AsyncIterableIterator<FileHandleLike | DirectoryHandleLike>;
  getFileHandle(
    name: string,
    options: { create: boolean },
  ): Promise<FileHandleLike>;
  getDirectoryHandle(
    name: string,
    options: { create: boolean },
  ): Promise<DirectoryHandleLike>;
};

type CompressionCheck = {
  pageCount: number;
  renderedPages: number;
  worstSimilarity: number;
  worstLocalSimilarity: number;
  worstHighFrequencySimilarity: number;
  profilePixelHash: string;
  profilePixelCount: number;
  profileStreamHash: string;
  profileImageStreamCount: number;
  originalSize: number;
  outputSize: number;
  usedOriginalBytes: boolean;
};

type CompressionOutput = {
  bytes: Uint8Array;
  checks: CompressionCheck;
};

type QueueStatus = "ready" | "processing" | "success" | "error";

type QueueItem = {
  id: string;
  file: File;
  outputName: string;
  directory?: DirectoryHandleLike;
  status: QueueStatus;
  progress: string;
  downloadUrl?: string;
  checks?: CompressionCheck;
  error?: string;
};

type CompressionPreset = {
  label: string;
  scale: number;
  qualities: number[];
};

export type CancellationCheck = () => boolean;

type RenderBudget = {
  label: string;
  maxPages: number;
  maxTotalPixels: number;
  requestedScale: number;
};

type EncodedPagePass = {
  encodedPages: Map<number, Uint8Array>;
  encodedBytes: number;
};

type PdfStructureInspection = {
  hasAcroForm: boolean;
  hasAnnotation: boolean;
  hasDigitalSignature: boolean;
  hasWidget: boolean;
};

const compressionPresets: CompressionPreset[] = [
  {
    label: "清晰",
    scale: 1.45,
    qualities: [0.8, 0.72, 0.64, 0.56, 0.48],
  },
  {
    label: "节省空间",
    scale: 1.18,
    qualities: [0.58, 0.5, 0.44],
  },
];

let pdfLibPromise: Promise<PdfLibModule> | undefined;
let pdfJsPromise: Promise<PdfJsModule> | undefined;
let pdfWorkerUrl: string | undefined;

export function loadPdfLib() {
  pdfLibPromise ??= import("pdf-lib");
  return pdfLibPromise;
}

export async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?raw"),
    ]).then(([pdfJs, workerModule]) => {
      if (!pdfWorkerUrl) {
        const workerSource = workerModule.default;
        pdfWorkerUrl = URL.createObjectURL(
          new Blob([workerSource], { type: "text/javascript" }),
        );
      }
      pdfJs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return pdfJs;
    });
  }
  return pdfJsPromise;
}

export function createQueueId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLocaleLowerCase().endsWith(".pdf")
  );
}

function makeOutputName(inputName: string) {
  const baseName = inputName.replace(/\.pdf$/i, "");
  return `${baseName}${OUTPUT_SUFFIX}.pdf`;
}

function makeUniqueOutputName(inputName: string, existingNames: Set<string>) {
  const requested = makeOutputName(inputName);
  if (!existingNames.has(requested)) {
    existingNames.add(requested);
    return requested;
  }

  const stem = requested.replace(/\.pdf$/i, "");
  let copyNumber = 2;
  let candidate = `${stem}_${copyNumber}.pdf`;
  while (existingNames.has(candidate)) {
    copyNumber += 1;
    candidate = `${stem}_${copyNumber}.pdf`;
  }
  existingNames.add(candidate);
  return candidate;
}

export function formatBytes(bytes: number) {
  if (bytes < 1_000_000) {
    return `${(bytes / 1_000).toFixed(1)} KB`;
  }
  return `${(bytes / 1_000_000).toFixed(3)} MB`;
}

function getSafeScale(page: PDFPageProxy, requestedScale: number, rotation?: number) {
  const unitViewport = page.getViewport({
    scale: 1,
    rotation: rotation ?? page.rotate,
  });
  return Math.min(
    requestedScale,
    MAX_RENDER_EDGE / Math.max(unitViewport.width, unitViewport.height),
    Math.sqrt(MAX_RENDER_PIXELS / (unitViewport.width * unitViewport.height)),
  );
}

export function throwIfCancelled(shouldCancel?: CancellationCheck) {
  if (shouldCancel?.()) {
    throw new Error("已取消处理，未生成或保存任何压缩件。");
  }
}

export function assertInputFileBudget(
  file: File,
  maxBytes: number,
  label: string,
) {
  if (file.size === 0) {
    throw new Error("文件为空（0 字节），无法读取或压缩。");
  }
  if (file.size > maxBytes) {
    throw new Error(
      `${label}原文件为 ${formatBytes(file.size)}，超过本机安全上限 ${formatBytes(maxBytes)}；为避免移动端内存不足，已停止处理。`,
    );
  }
}

function boxesMatch(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return (["x", "y", "width", "height"] as const).every(
    (field) => Math.abs(first[field] - second[field]) <= 0.01,
  );
}

export function inspectPdfStructures(
  pdfLib: PdfLibModule,
  source: PdfLibDocument,
): PdfStructureInspection {
  const acroFormEntry = source.catalog.get(pdfLib.PDFName.of("AcroForm"));
  const acroForm = acroFormEntry
    ? source.context.lookup(acroFormEntry)
    : undefined;
  let hasDigitalSignature = false;
  let hasWidget = false;
  let hasAnnotation = false;

  for (const [, object] of source.context.enumerateIndirectObjects()) {
    const dictionary =
      object instanceof pdfLib.PDFStream
        ? object.dict
        : object instanceof pdfLib.PDFDict
          ? object
          : undefined;
    if (!dictionary) {
      continue;
    }
    const fieldType = dictionary.lookupMaybe(
      pdfLib.PDFName.of("FT"),
      pdfLib.PDFName,
    );
    const objectType = dictionary.lookupMaybe(
      pdfLib.PDFName.of("Type"),
      pdfLib.PDFName,
    );
    const subtype = dictionary.lookupMaybe(
      pdfLib.PDFName.of("Subtype"),
      pdfLib.PDFName,
    );
    if (
      fieldType?.asString() === "/Sig" ||
      objectType?.asString() === "/Sig"
    ) {
      hasDigitalSignature = true;
    }
    if (subtype?.asString() === "/Widget") {
      hasWidget = true;
    }
  }

  for (const page of source.getPages()) {
    const annotations = page.node.Annots();
    if (annotations && annotations.size() > 0) {
      hasAnnotation = true;
      for (let index = 0; index < annotations.size(); index += 1) {
        const annotation = annotations.lookupMaybe(index, pdfLib.PDFDict);
        const subtype = annotation?.lookupMaybe(
          pdfLib.PDFName.of("Subtype"),
          pdfLib.PDFName,
        );
        if (subtype?.asString() === "/Widget") {
          hasWidget = true;
        }
      }
    }
  }

  return {
    hasAcroForm: acroForm instanceof pdfLib.PDFDict,
    hasAnnotation,
    hasDigitalSignature,
    hasWidget,
  };
}

export function assertRasterizationSafe(
  pdfLib: PdfLibModule,
  source: PdfLibDocument,
  rasterizedPageIndexes: number[],
  inspection = inspectPdfStructures(pdfLib, source),
) {
  if (inspection.hasDigitalSignature) {
    throw new Error(
      "检测到数字签名字段（/Sig）；重新编码会使签名失效，已安全停止且不给出下载。",
    );
  }
  if (inspection.hasAcroForm || inspection.hasWidget) {
    throw new Error(
      "检测到交互式表单（/AcroForm 或 Widget）；当前压缩无法保证字段结构和填写值仍可编辑，已安全停止且不给出下载。",
    );
  }
  if (inspection.hasAnnotation) {
    throw new Error(
      "检测到页面批注或附件注释（/Annots）；当前压缩无法可靠保留其结构，已安全停止且不给出下载。",
    );
  }

  const pages = source.getPages();
  for (const pageIndex of rasterizedPageIndexes) {
    const media = pages[pageIndex].getMediaBox();
    const crop = pages[pageIndex].getCropBox();
    if (!boxesMatch(media, crop)) {
      throw new Error(
        `第 ${pageIndex + 1} 页的 CropBox 与 MediaBox 不一致；当前浏览器无法可靠渲染 CropBox 外内容，已安全停止且不给出下载。`,
      );
    }
  }
}

export async function assertDocumentRenderBudget(
  document: PDFDocumentProxy,
  budget: RenderBudget,
  shouldCancel?: CancellationCheck,
) {
  if (document.numPages > budget.maxPages) {
    throw new Error(
      `${budget.label}共 ${document.numPages} 页，超过本机安全上限 ${budget.maxPages} 页；为避免移动端内存不足，已停止处理。`,
    );
  }

  let totalPixels = 0;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    throwIfCancelled(shouldCancel);
    const page = await document.getPage(pageNumber);
    try {
      const viewport = page.getViewport({ scale: 1, rotation: 0 });
      const area = viewport.width * viewport.height;
      if (
        !Number.isFinite(area) ||
        Math.max(viewport.width, viewport.height) > MAX_PAGE_EDGE_POINTS ||
        area > MAX_PAGE_AREA_POINTS
      ) {
        throw new Error(
          `第 ${pageNumber} 页尺寸异常（${Math.round(viewport.width)}×${Math.round(viewport.height)} 点），超过本机安全像素上限。`,
        );
      }
      const scale = getSafeScale(page, budget.requestedScale, 0);
      totalPixels +=
        Math.ceil(viewport.width * scale) *
        Math.ceil(viewport.height * scale);
      if (totalPixels > budget.maxTotalPixels) {
        throw new Error(
          `${budget.label}预计需渲染超过 ${budget.maxTotalPixels.toLocaleString("zh-CN")} 像素，超出本机安全预算；已停止处理。`,
        );
      }
    } finally {
      page.cleanup();
    }
  }
}

export async function encodePagesAtQuality(
  source: PDFDocumentProxy,
  pageIndexes: number[],
  scale: number,
  quality: number,
  maxEncodedBytes: number,
  reportProgress: (message: string) => void,
  progressLabel: string,
  shouldCancel?: CancellationCheck,
): Promise<EncodedPagePass | undefined> {
  const encodedPages = new Map<number, Uint8Array>();
  let encodedBytes = 0;

  for (let position = 0; position < pageIndexes.length; position += 1) {
    throwIfCancelled(shouldCancel);
    const pageIndex = pageIndexes[position];
    reportProgress(
      `${progressLabel} ${position + 1}/${pageIndexes.length} · 质量 ${Math.round(quality * 100)}%`,
    );
    const page = await source.getPage(pageIndex + 1);
    const canvas = await renderPage(page, scale, 0);
    try {
      throwIfCancelled(shouldCancel);
      const jpeg = await canvasToJpeg(canvas, quality);
      encodedBytes += jpeg.byteLength;
      if (encodedBytes > maxEncodedBytes) {
        encodedPages.clear();
        return undefined;
      }
      encodedPages.set(pageIndex, jpeg);
    } finally {
      closeCanvas(canvas);
      page.cleanup();
    }
  }

  return { encodedPages, encodedBytes };
}

export async function renderPage(
  page: PDFPageProxy,
  requestedScale: number,
  rotation?: number,
) {
  const scale = getSafeScale(page, requestedScale, rotation);
  const viewport = page.getViewport({
    scale,
    rotation: rotation ?? page.rotate,
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));

  await page.render({
    canvas,
    viewport,
    intent: "display",
    background: "#ffffff",
  }).promise;

  return canvas;
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("浏览器无法生成 JPEG 压缩页。"));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      "image/jpeg",
      quality,
    );
  });
}

export function copyMetadata(source: PdfLibDocument, target: PdfLibDocument) {
  const title = source.getTitle();
  const author = source.getAuthor();
  const subject = source.getSubject();
  const keywords = source.getKeywords();
  const creator = source.getCreator();
  const producer = source.getProducer();
  const creationDate = source.getCreationDate();
  const modificationDate = source.getModificationDate();

  if (title) target.setTitle(title);
  if (author) target.setAuthor(author);
  if (subject) target.setSubject(subject);
  if (keywords) {
    target.setKeywords(
      keywords
        .split(/[,;]\s*/)
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    );
  }
  if (creator) target.setCreator(creator);
  if (producer) target.setProducer(producer);
  if (creationDate) target.setCreationDate(creationDate);
  if (modificationDate) target.setModificationDate(modificationDate);
}

export function copyPageGeometry(source: PdfLibPage, target: PdfLibPage) {
  const media = source.getMediaBox();
  const crop = source.getCropBox();
  const bleed = source.getBleedBox();
  const trim = source.getTrimBox();
  const art = source.getArtBox();

  target.setMediaBox(media.x, media.y, media.width, media.height);
  target.setCropBox(crop.x, crop.y, crop.width, crop.height);
  target.setBleedBox(bleed.x, bleed.y, bleed.width, bleed.height);
  target.setTrimBox(trim.x, trim.y, trim.width, trim.height);
  target.setArtBox(art.x, art.y, art.width, art.height);
  target.setRotation(source.getRotation());
}

async function createProfileProbe(
  pdfLib: PdfLibModule,
  source: PdfLibDocument,
) {
  const probe = await pdfLib.PDFDocument.create({ updateMetadata: false });
  const [profilePage] = await probe.copyPages(source, [PROFILE_PAGE_INDEX]);
  probe.addPage(profilePage);
  return probe.save({
    addDefaultPage: false,
    updateFieldAppearances: false,
    useObjectStreams: true,
  });
}

async function buildCompressedPdf(
  pdfLib: PdfLibModule,
  source: PdfLibDocument,
  encodedPages: Map<number, Uint8Array>,
) {
  const output = await pdfLib.PDFDocument.create({ updateMetadata: false });
  copyMetadata(source, output);
  const sourcePages = source.getPages();
  const [profilePage] = await output.copyPages(source, [PROFILE_PAGE_INDEX]);

  for (let pageIndex = 0; pageIndex < sourcePages.length; pageIndex += 1) {
    if (pageIndex === PROFILE_PAGE_INDEX) {
      output.addPage(profilePage);
      continue;
    }

    const sourcePage = sourcePages[pageIndex];
    const media = sourcePage.getMediaBox();
    const crop = sourcePage.getCropBox();
    const outputPage = output.addPage([media.width, media.height]);
    copyPageGeometry(sourcePage, outputPage);

    const jpegBytes = encodedPages.get(pageIndex);
    if (!jpegBytes) {
      throw new Error(`第 ${pageIndex + 1} 页缺少压缩数据。`);
    }
    const image = await output.embedJpg(jpegBytes);
    outputPage.drawImage(image, {
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height,
    });
  }

  return output.save({
    addDefaultPage: false,
    updateFieldAppearances: false,
    useObjectStreams: true,
  });
}

export function closeCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

export function compareGeometry(source: PdfLibPage, output: PdfLibPage) {
  const sourceBoxes = [
    source.getMediaBox(),
    source.getCropBox(),
    source.getBleedBox(),
    source.getTrimBox(),
    source.getArtBox(),
  ];
  const outputBoxes = [
    output.getMediaBox(),
    output.getCropBox(),
    output.getBleedBox(),
    output.getTrimBox(),
    output.getArtBox(),
  ];
  const fields = ["x", "y", "width", "height"] as const;

  for (let boxIndex = 0; boxIndex < sourceBoxes.length; boxIndex += 1) {
    for (const field of fields) {
      if (
        Math.abs(sourceBoxes[boxIndex][field] - outputBoxes[boxIndex][field]) >
        0.01
      ) {
        return false;
      }
    }
  }

  return source.getRotation().angle === output.getRotation().angle;
}

export function compareRenderedPages(
  sourceCanvas: HTMLCanvasElement,
  outputCanvas: HTMLCanvasElement,
  requireExact: boolean,
) {
  if (
    sourceCanvas.width !== outputCanvas.width ||
    sourceCanvas.height !== outputCanvas.height
  ) {
    return {
      exact: false,
      similarity: 0,
      localSimilarity: 0,
      highFrequencySimilarity: 0,
      sourcePixels: new Uint8ClampedArray(),
    };
  }

  const sourceContext = sourceCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  const outputContext = outputCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!sourceContext || !outputContext) {
    throw new Error("浏览器无法读取 PDF 渲染像素。");
  }

  const sourcePixels = sourceContext.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  ).data;
  const outputPixels = outputContext.getImageData(
    0,
    0,
    outputCanvas.width,
    outputCanvas.height,
  ).data;
  let absoluteDifference = 0;
  let exact = true;
  let sourceLuminance = 0;
  let outputLuminance = 0;

  for (let index = 0; index < sourcePixels.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const difference = Math.abs(
        sourcePixels[index + channel] - outputPixels[index + channel],
      );
      absoluteDifference += difference;
      if (difference !== 0) {
        exact = false;
      }
    }
    sourceLuminance +=
      sourcePixels[index] * 0.2126 +
      sourcePixels[index + 1] * 0.7152 +
      sourcePixels[index + 2] * 0.0722;
    outputLuminance +=
      outputPixels[index] * 0.2126 +
      outputPixels[index + 1] * 0.7152 +
      outputPixels[index + 2] * 0.0722;
  }

  const pixelCount = sourcePixels.length / 4;
  const meanAbsoluteError = absoluteDifference / (pixelCount * 3);
  const sourceMeanLuminance = sourceLuminance / pixelCount;
  const outputMeanLuminance = outputLuminance / pixelCount;
  const blackPage =
    sourceMeanLuminance > 35 &&
    outputMeanLuminance < Math.min(22, sourceMeanLuminance * 0.35);
  let worstLocalMae = 0;
  let worstHighFrequencyMae = 0;
  const tileWidth = Math.max(1, Math.ceil(sourceCanvas.width / LOCAL_GRID_SIZE));
  const tileHeight = Math.max(
    1,
    Math.ceil(sourceCanvas.height / LOCAL_GRID_SIZE),
  );

  for (let tileY = 0; tileY < sourceCanvas.height; tileY += tileHeight) {
    for (let tileX = 0; tileX < sourceCanvas.width; tileX += tileWidth) {
      const endX = Math.min(sourceCanvas.width, tileX + tileWidth);
      const endY = Math.min(sourceCanvas.height, tileY + tileHeight);
      let tileDifference = 0;
      let tilePixels = 0;
      let sourceMinimum = 255;
      let sourceMaximum = 0;
      let highFrequencyDifference = 0;
      let highFrequencyPixels = 0;

      for (let y = tileY; y < endY; y += 1) {
        for (let x = tileX; x < endX; x += 1) {
          const index = (y * sourceCanvas.width + x) * 4;
          const sourceValue =
            sourcePixels[index] * 0.2126 +
            sourcePixels[index + 1] * 0.7152 +
            sourcePixels[index + 2] * 0.0722;
          sourceMinimum = Math.min(sourceMinimum, sourceValue);
          sourceMaximum = Math.max(sourceMaximum, sourceValue);
          let pixelDifference = 0;
          for (let channel = 0; channel < 3; channel += 1) {
            pixelDifference += Math.abs(
              sourcePixels[index + channel] - outputPixels[index + channel],
            );
          }
          tileDifference += pixelDifference;
          tilePixels += 1;

          const leftIndex = x > 0 ? index - 4 : index;
          const upperIndex =
            y > 0 ? index - sourceCanvas.width * 4 : index;
          const leftLuminance =
            sourcePixels[leftIndex] * 0.2126 +
            sourcePixels[leftIndex + 1] * 0.7152 +
            sourcePixels[leftIndex + 2] * 0.0722;
          const upperLuminance =
            sourcePixels[upperIndex] * 0.2126 +
            sourcePixels[upperIndex + 1] * 0.7152 +
            sourcePixels[upperIndex + 2] * 0.0722;
          if (
            Math.max(
              Math.abs(sourceValue - leftLuminance),
              Math.abs(sourceValue - upperLuminance),
            ) >= HIGH_FREQUENCY_DELTA
          ) {
            highFrequencyDifference += pixelDifference;
            highFrequencyPixels += 1;
          }
        }
      }

      if (sourceMaximum - sourceMinimum >= 24 && tilePixels > 0) {
        worstLocalMae = Math.max(
          worstLocalMae,
          tileDifference / (tilePixels * 3),
        );
      }
      if (highFrequencyPixels >= 8) {
        worstHighFrequencyMae = Math.max(
          worstHighFrequencyMae,
          highFrequencyDifference / (highFrequencyPixels * 3),
        );
      }
    }
  }
  const globalSimilarity = Math.max(0, 1 - meanAbsoluteError / 255);
  const localSimilarity = Math.max(0, 1 - worstLocalMae / 255);
  const highFrequencySimilarity = Math.max(
    0,
    1 - worstHighFrequencyMae / 255,
  );

  if (requireExact && !exact) {
    return {
      exact: false,
      similarity: 0,
      localSimilarity: 0,
      highFrequencySimilarity: 0,
      sourcePixels,
    };
  }
  if (
    blackPage ||
    meanAbsoluteError > MAX_OTHER_PAGE_MAE ||
    worstLocalMae > MAX_LOCAL_TILE_MAE ||
    worstHighFrequencyMae > MAX_HIGH_FREQUENCY_MAE
  ) {
    return {
      exact,
      similarity: 0,
      localSimilarity,
      highFrequencySimilarity,
      sourcePixels,
    };
  }

  return {
    exact,
    similarity: Math.min(
      globalSimilarity,
      localSimilarity,
      highFrequencySimilarity,
    ),
    localSimilarity,
    highFrequencySimilarity,
    sourcePixels,
  };
}

async function sha256(data: Uint8Array | Uint8ClampedArray) {
  const bytes = new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getProfileStreamFingerprint(
  pdfLib: PdfLibModule,
  page: PdfLibPage,
) {
  const contentDigests: string[] = [];
  const imageDigests: string[] = [];
  const visitedStreams = new WeakSet<object>();

  const addContentStream = async (stream: PDFStream) => {
    contentDigests.push(await sha256(stream.getContents()));
  };

  const visitXObjectStream = async (
    stream: PDFStream,
  ): Promise<void> => {
    if (visitedStreams.has(stream)) {
      return;
    }
    visitedStreams.add(stream);

    const subtype = stream.dict.lookupMaybe(
      pdfLib.PDFName.of("Subtype"),
      pdfLib.PDFName,
    );
    if (subtype?.asString() === "/Image") {
      imageDigests.push(await sha256(stream.getContents()));
    }

    const nestedResources = stream.dict.lookupMaybe(
      pdfLib.PDFName.Resources,
      pdfLib.PDFDict,
    );
    if (nestedResources) {
      await visitResources(nestedResources);
    }

    for (const imageKey of ["SMask", "Mask"]) {
      const candidate = stream.dict.get(pdfLib.PDFName.of(imageKey));
      const resolved = stream.dict.context.lookup(candidate);
      if (resolved instanceof pdfLib.PDFStream) {
        await visitXObjectStream(resolved);
      }
    }
  };

  const visitResources = async (resources: PDFDict) => {
    const xObjects = resources.lookupMaybe(
      pdfLib.PDFName.XObject,
      pdfLib.PDFDict,
    );
    if (!xObjects) {
      return;
    }
    for (const value of xObjects.values()) {
      const resolved = xObjects.context.lookup(value);
      if (resolved instanceof pdfLib.PDFStream) {
        await visitXObjectStream(resolved);
      }
    }
  };

  const contents = page.node.Contents();
  if (contents instanceof pdfLib.PDFStream) {
    await addContentStream(contents);
  } else if (contents instanceof pdfLib.PDFArray) {
    for (let index = 0; index < contents.size(); index += 1) {
      const stream = contents.lookupMaybe(index, pdfLib.PDFStream);
      if (stream) {
        await addContentStream(stream);
      }
    }
  }

  const resources = page.node.Resources();
  if (resources) {
    await visitResources(resources);
  }

  contentDigests.sort();
  imageDigests.sort();
  const fingerprintSource = new TextEncoder().encode(
    JSON.stringify({ contentDigests, imageDigests }),
  );
  return {
    hash: await sha256(fingerprintSource),
    imageStreamCount: imageDigests.length,
    contentDigests,
    imageDigests,
  };
}

export async function openPdfJsDocument(
  pdfJs: PdfJsModule,
  bytes: Uint8Array,
) {
  const loadingTask = pdfJs.getDocument({
    data: bytes.slice(0),
    isEvalSupported: false,
    useSystemFonts: true,
  });
  return loadingTask.promise;
}

async function verifyOutput(
  pdfLib: PdfLibModule,
  pdfJs: PdfJsModule,
  sourceLibDocument: PdfLibDocument,
  sourceJsDocument: PDFDocumentProxy,
  originalBytes: Uint8Array,
  outputBytes: Uint8Array,
  usedOriginalBytes: boolean,
  reportProgress: (message: string) => void,
  shouldCancel?: CancellationCheck,
) {
  if (outputBytes.byteLength > TARGET_BYTES) {
    throw new Error(
      `成品为 ${outputBytes.byteLength.toLocaleString("zh-CN")} 字节，超过 2,900,000 字节，已停止保存。`,
    );
  }

  const outputLibDocument = await pdfLib.PDFDocument.load(outputBytes, {
    ignoreEncryption: false,
    updateMetadata: false,
  });
  const outputJsDocument = await openPdfJsDocument(pdfJs, outputBytes);

  try {
    if (
      sourceLibDocument.getPageCount() !== outputLibDocument.getPageCount() ||
      sourceJsDocument.numPages !== outputJsDocument.numPages
    ) {
      throw new Error("核验失败：压缩前后页数不一致。");
    }

    const sourceLibPages = sourceLibDocument.getPages();
    const outputLibPages = outputLibDocument.getPages();
    let worstSimilarity = 1;
    let worstLocalSimilarity = 1;
    let worstHighFrequencySimilarity = 1;
    let profilePixelHash = "";
    let profilePixelCount = 0;
    let profileStreamHash = "";
    let profileImageStreamCount = 0;

    const [sourceStreamFingerprint, outputStreamFingerprint] =
      await Promise.all([
        getProfileStreamFingerprint(
          pdfLib,
          sourceLibPages[PROFILE_PAGE_INDEX],
        ),
        getProfileStreamFingerprint(
          pdfLib,
          outputLibPages[PROFILE_PAGE_INDEX],
        ),
      ]);
    if (
      JSON.stringify(sourceStreamFingerprint.contentDigests) !==
        JSON.stringify(outputStreamFingerprint.contentDigests) ||
      JSON.stringify(sourceStreamFingerprint.imageDigests) !==
        JSON.stringify(outputStreamFingerprint.imageDigests)
    ) {
      throw new Error(
        "核验失败：第 3 页的内容流或图像流数据发生变化，已停止保存。",
      );
    }
    profileStreamHash = sourceStreamFingerprint.hash;
    profileImageStreamCount = sourceStreamFingerprint.imageStreamCount;

    for (
      let pageIndex = 0;
      pageIndex < sourceJsDocument.numPages;
      pageIndex += 1
    ) {
      throwIfCancelled(shouldCancel);
      reportProgress(
        `正在逐页核验 ${pageIndex + 1}/${sourceJsDocument.numPages}`,
      );
      if (!compareGeometry(sourceLibPages[pageIndex], outputLibPages[pageIndex])) {
        throw new Error(
          `核验失败：第 ${pageIndex + 1} 页的尺寸、页面框或旋转方向发生变化。`,
        );
      }

      const [sourcePage, outputPage] = await Promise.all([
        sourceJsDocument.getPage(pageIndex + 1),
        outputJsDocument.getPage(pageIndex + 1),
      ]);
      const isProfilePage = pageIndex === PROFILE_PAGE_INDEX;
      const validationScale = isProfilePage
        ? PROFILE_VALIDATION_SCALE
        : OTHER_PAGE_VALIDATION_SCALE;
      const [sourceCanvas, outputCanvas] = await Promise.all([
        renderPage(sourcePage, validationScale),
        renderPage(outputPage, validationScale),
      ]);

      try {
        const comparison = compareRenderedPages(
          sourceCanvas,
          outputCanvas,
          isProfilePage,
        );
        if (isProfilePage) {
          if (!comparison.exact) {
            throw new Error(
              "核验失败：第 3 页渲染像素与原件不完全一致，已停止保存。",
            );
          }
          profilePixelHash = await sha256(comparison.sourcePixels);
          profilePixelCount =
            sourceCanvas.width * sourceCanvas.height;
        } else {
          if (comparison.similarity === 0) {
            throw new Error(
              `核验失败：第 ${pageIndex + 1} 页疑似黑页、缺失或与原件差异过大（局部分块 ${(comparison.localSimilarity * 100).toFixed(2)}%，高频边缘 ${(comparison.highFrequencySimilarity * 100).toFixed(2)}%）。`,
            );
          }
          worstSimilarity = Math.min(
            worstSimilarity,
            comparison.similarity,
          );
          worstLocalSimilarity = Math.min(
            worstLocalSimilarity,
            comparison.localSimilarity,
          );
          worstHighFrequencySimilarity = Math.min(
            worstHighFrequencySimilarity,
            comparison.highFrequencySimilarity,
          );
        }
      } finally {
        closeCanvas(sourceCanvas);
        closeCanvas(outputCanvas);
        sourcePage.cleanup();
        outputPage.cleanup();
      }
    }

    return {
      pageCount: sourceJsDocument.numPages,
      renderedPages: sourceJsDocument.numPages,
      worstSimilarity,
      worstLocalSimilarity,
      worstHighFrequencySimilarity,
      profilePixelHash,
      profilePixelCount,
      profileStreamHash,
      profileImageStreamCount,
      originalSize: originalBytes.byteLength,
      outputSize: outputBytes.byteLength,
      usedOriginalBytes,
    } satisfies CompressionCheck;
  } finally {
    await outputJsDocument.destroy();
  }
}

async function compressPassportPdf(
  file: File,
  reportProgress: (message: string) => void,
  shouldCancel?: CancellationCheck,
): Promise<CompressionOutput> {
  assertInputFileBudget(file, MAX_PASSPORT_INPUT_BYTES, "护照 PDF ");
  throwIfCancelled(shouldCancel);
  const [pdfLib, pdfJs] = await Promise.all([loadPdfLib(), loadPdfJs()]);
  const originalBytes = new Uint8Array(await file.arrayBuffer());
  throwIfCancelled(shouldCancel);
  reportProgress("正在读取 PDF 结构");

  const sourceLibDocument = await pdfLib.PDFDocument.load(originalBytes, {
    ignoreEncryption: false,
    updateMetadata: false,
  });
  const sourceJsDocument = await openPdfJsDocument(pdfJs, originalBytes);

  try {
    if (
      sourceLibDocument.getPageCount() !== sourceJsDocument.numPages ||
      sourceJsDocument.numPages < PROFILE_PAGE_INDEX + 1
    ) {
      throw new Error("文件至少需要 3 页，且 PDF 页树必须完整。");
    }
    await assertDocumentRenderBudget(
      sourceJsDocument,
      {
        label: "护照 PDF ",
        maxPages: MAX_PASSPORT_PAGES,
        maxTotalPixels: MAX_PASSPORT_TOTAL_RENDER_PIXELS,
        requestedScale: Math.max(
          PROFILE_VALIDATION_SCALE,
          compressionPresets[0].scale,
        ),
      },
      shouldCancel,
    );
    const structureInspection = inspectPdfStructures(
      pdfLib,
      sourceLibDocument,
    );

    let outputBytes: Uint8Array;
    let usedOriginalBytes = false;

    if (originalBytes.byteLength <= TARGET_BYTES) {
      reportProgress("原文件已在 2.9 MB 内，保留全部原始字节");
      outputBytes = originalBytes.slice(0);
      usedOriginalBytes = true;
    } else {
      const rasterizedPageIndexes = Array.from(
        { length: sourceJsDocument.numPages },
        (_, pageIndex) => pageIndex,
      ).filter((pageIndex) => pageIndex !== PROFILE_PAGE_INDEX);
      assertRasterizationSafe(
        pdfLib,
        sourceLibDocument,
        rasterizedPageIndexes,
        structureInspection,
      );
      throwIfCancelled(shouldCancel);
      const profileProbe = await createProfileProbe(pdfLib, sourceLibDocument);
      if (profileProbe.byteLength >= TARGET_BYTES - 20_000) {
        throw new Error(
          "第 3 页在不重新编码的前提下已占用几乎全部体积预算，无法安全压到 2.9 MB 内。",
        );
      }

      outputBytes = new Uint8Array();
      let builtCandidate = false;

      for (const preset of compressionPresets) {
        for (const quality of preset.qualities) {
          throwIfCancelled(shouldCancel);
          reportProgress(`正在按“${preset.label}”档逐页压缩`);
          const pass = await encodePagesAtQuality(
            sourceJsDocument,
            rasterizedPageIndexes,
            preset.scale,
            quality,
            MAX_PASSPORT_ENCODED_BYTES,
            reportProgress,
            "正在压缩非资料页",
            shouldCancel,
          );
          if (!pass) {
            continue;
          }
          const estimatedBytes =
            profileProbe.byteLength + 20_000 + pass.encodedBytes;
          if (estimatedBytes > TARGET_BYTES) {
            pass.encodedPages.clear();
            continue;
          }

          reportProgress(
            `正在封装 PDF（${preset.label} · 质量 ${Math.round(
              quality * 100,
            )}%）`,
          );
          const candidate = await buildCompressedPdf(
            pdfLib,
            sourceLibDocument,
            pass.encodedPages,
          );
          pass.encodedPages.clear();
          if (candidate.byteLength <= TARGET_BYTES) {
            outputBytes = candidate;
            builtCandidate = true;
            break;
          }
        }

        if (builtCandidate) {
          break;
        }
      }

      if (!builtCandidate) {
        throw new Error(
          "在保持第 3 页原始质量、其他页清晰可读的安全档位内，无法压到 2,900,000 字节；未生成成品。",
        );
      }
    }

    reportProgress("正在打开成品并执行逐页核验");
    const checks = await verifyOutput(
      pdfLib,
      pdfJs,
      sourceLibDocument,
      sourceJsDocument,
      originalBytes,
      outputBytes,
      usedOriginalBytes,
      reportProgress,
      shouldCancel,
    );
    return { bytes: outputBytes, checks };
  } finally {
    await sourceJsDocument.destroy();
  }
}

export async function saveToDirectory(
  directory: DirectoryHandleLike,
  name: string,
  bytes: Uint8Array,
) {
  const outputHandle = await directory.getFileHandle(name, { create: true });
  const writable = await outputHandle.createWritable();
  try {
    const stableBytes = new Uint8Array(bytes);
    await writable.write(
      new Blob([stableBytes.buffer], { type: "application/pdf" }),
    );
  } finally {
    await writable.close();
  }
}

export default function PassportPdfCompressor() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [supportsDirectoryPicker, setSupportsDirectoryPicker] = useState(false);
  const [wechatMode, setWechatMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<QueueItem[]>([]);
  const cancelRequestedRef = useRef(false);

  useEffect(() => {
    setSupportsDirectoryPicker(
      typeof window !== "undefined" && "showDirectoryPicker" in window,
    );
    setWechatMode(isWeChatUserAgent(navigator.userAgent));
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(
    () => () => {
      for (const item of itemsRef.current) {
        if (item.downloadUrl) {
          URL.revokeObjectURL(item.downloadUrl);
        }
      }
    },
    [],
  );

  const addFiles = (
    files: File[],
    directory?: DirectoryHandleLike,
    existingNames = new Set<string>(),
  ) => {
    const pdfFiles = files.filter(isPdfFile);
    if (pdfFiles.length === 0) {
      return;
    }

    setItems((current) => {
      for (const item of current) {
        if (item.outputName) {
          existingNames.add(item.outputName);
        }
      }
      const knownFiles = new Set(
        current.map(
          (item) =>
            `${item.file.name}\u0000${item.file.size}\u0000${item.file.lastModified}`,
        ),
      );
      const additions = pdfFiles
        .filter(
          (file) =>
            !knownFiles.has(
              `${file.name}\u0000${file.size}\u0000${file.lastModified}`,
            ),
        )
        .map((file): QueueItem => {
          const error =
            file.size === 0
              ? "文件为空（0 字节），无法读取或压缩。"
              : file.size > MAX_PASSPORT_INPUT_BYTES
                ? `原文件超过 ${formatBytes(MAX_PASSPORT_INPUT_BYTES)} 本机安全上限，未加入处理队列。`
                : undefined;
          return {
            id: createQueueId(),
            file,
            outputName: makeUniqueOutputName(file.name, existingNames),
            directory,
            status: error ? "error" : "ready",
            progress: error ? "无法处理" : "等待处理",
            error,
          };
        });
      return [...current, ...additions];
    });
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const selectDirectory = async () => {
    const picker = (
      window as Window & {
        showDirectoryPicker?: (options: {
          mode: "readwrite";
        }) => Promise<DirectoryHandleLike>;
      }
    ).showDirectoryPicker;
    if (!picker) {
      return;
    }

    try {
      const directory = await picker({ mode: "readwrite" });
      const files: File[] = [];
      const existingNames = new Set<string>();
      for await (const handle of directory.values()) {
        existingNames.add(handle.name);
        if (
          handle.kind === "file" &&
          handle.name.toLowerCase().endsWith(".pdf") &&
          !handle.name.includes(OUTPUT_SUFFIX)
        ) {
          files.push(await handle.getFile());
        }
      }
      addFiles(files, directory, existingNames);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setItems((current) => [
        ...current,
        {
          id: createQueueId(),
          file: new File([], "文件夹读取失败.pdf", {
            type: "application/pdf",
          }),
          outputName: "",
          status: "error",
          progress: "",
          error:
            error instanceof Error
              ? error.message
              : "无法读取所选文件夹。",
        },
      ]);
    }
  };

  const updateItem = (id: string, patch: Partial<QueueItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const startCompression = async () => {
    const queue = items.filter((item) => item.status === "ready");
    if (queue.length === 0) {
      return;
    }

    setIsProcessing(true);
    cancelRequestedRef.current = false;
    for (const item of queue) {
      if (cancelRequestedRef.current) {
        break;
      }
      updateItem(item.id, {
        status: "processing",
        progress: "正在准备本地压缩",
        error: undefined,
      });

      try {
        const result = await compressPassportPdf(
          item.file,
          (progress) => {
            updateItem(item.id, { progress });
          },
          () => cancelRequestedRef.current,
        );
        throwIfCancelled(() => cancelRequestedRef.current);
        let downloadUrl: string | undefined;
        let progress: string;

        if (item.directory) {
          updateItem(item.id, { progress: "核验通过，正在写回所选文件夹" });
          await saveToDirectory(
            item.directory,
            item.outputName,
            result.bytes,
          );
          progress = `已保存到文件夹：${item.outputName}`;
        } else {
          const stableBytes = new Uint8Array(result.bytes);
          downloadUrl = URL.createObjectURL(
            new Blob([stableBytes.buffer], { type: "application/pdf" }),
          );
          progress = "核验通过，可下载压缩件";
        }

        updateItem(item.id, {
          status: "success",
          progress,
          downloadUrl,
          checks: result.checks,
        });
      } catch (error) {
        updateItem(item.id, {
          status: "error",
          progress: "已停止，未保存不合格成品",
          error:
            error instanceof Error
              ? error.message
              : "压缩过程中发生未知错误。",
        });
      }
    }
    setIsProcessing(false);
    cancelRequestedRef.current = false;
  };

  const cancelCompression = () => {
    cancelRequestedRef.current = true;
  };

  const clearQueue = () => {
    if (isProcessing) {
      return;
    }
    for (const item of items) {
      if (item.downloadUrl) {
        URL.revokeObjectURL(item.downloadUrl);
      }
    }
    setItems([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const readyCount = items.filter((item) => item.status === "ready").length;

  return (
    <section
      className="passport-compressor"
      id="passport-compressor"
      aria-labelledby="passport-compressor-title"
    >
      <div className="passport-compressor-heading">
        <div>
          <span className="local-processing-badge">本机处理 · 不上传</span>
          <h3 id="passport-compressor-title">护照 PDF 安全压缩</h3>
          <p>
            把整本护照压到严格不超过 2,900,000 字节；第 3
            页直接复制原始页面，不重新编码。
          </p>
        </div>
        <span className="passport-target">
          硬上限 <strong>2.9 MB</strong>
        </span>
      </div>

      <div className="passport-guardrail" role="note">
        <strong>隐私与质量边界</strong>
        <p>
          文件只进入当前浏览器内存，不发送到本站或第三方。达不到体积与清晰度双重要求时会停止，不会牺牲第 3 页质量。
        </p>
      </div>

      <div className="passport-picker" role="group" aria-label="选择护照 PDF">
        <label className="passport-picker-primary">
          <input
            accept="application/pdf,.pdf"
            disabled={isProcessing}
            multiple
            onChange={handleFiles}
            ref={fileInputRef}
            type="file"
          />
          选择一个或多个 PDF
        </label>
        {supportsDirectoryPicker && (
          <button
            disabled={isProcessing}
            onClick={selectDirectory}
            type="button"
          >
            选择当前文件夹
          </button>
        )}
        <span>
          {supportsDirectoryPicker
            ? "选择文件夹后，将读取其中全部 PDF，并把成品另存回同一文件夹。"
            : "当前浏览器不支持文件夹写回；可多选 PDF，完成后逐个下载。"}
        </span>
      </div>

      {items.length > 0 && (
        <div className="passport-queue" aria-live="polite">
          <div className="passport-queue-heading">
            <strong>待处理文件（{items.length}）</strong>
            <button disabled={isProcessing} onClick={clearQueue} type="button">
              清空
            </button>
          </div>
          <ul>
            {items.map((item) => (
              <li
                className={`passport-file passport-file-${item.status}`}
                key={item.id}
              >
                <div className="passport-file-main">
                  <strong>{item.file.name}</strong>
                  <span>
                    原文件 {formatBytes(item.file.size)}
                    {item.outputName ? ` · 成品 ${item.outputName}` : ""}
                  </span>
                </div>
                <div className="passport-file-status">
                  <span>{item.progress}</span>
                  {item.status === "processing" && (
                    <span
                      className="passport-spinner"
                      aria-label="处理中"
                      role="status"
                    />
                  )}
                  {item.downloadUrl && (
                    <a download={item.outputName} href={item.downloadUrl}>
                      下载压缩件
                    </a>
                  )}
                </div>
                {item.checks && (
                  <dl className="passport-checks">
                    <div>
                      <dt>最终大小</dt>
                      <dd>
                        {formatBytes(item.checks.outputSize)}
                        <small>
                          {item.checks.outputSize.toLocaleString("zh-CN")} 字节
                        </small>
                      </dd>
                    </div>
                    <div>
                      <dt>页面核验</dt>
                      <dd>
                        {item.checks.renderedPages}/{item.checks.pageCount} 通过
                        <small>页数、顺序、页面框、方向一致</small>
                      </dd>
                    </div>
                    <div>
                      <dt>第 3 页</dt>
                      <dd>
                        逐像素一致
                        <small>
                          {item.checks.profilePixelCount.toLocaleString("zh-CN")} 像素 · {item.checks.profileImageStreamCount} 个图像流原样 · SHA-256{" "}
                          {item.checks.profilePixelHash.slice(0, 12)}…
                        </small>
                      </dd>
                    </div>
                    <div>
                      <dt>其他页面</dt>
                      <dd>
                        最低相似度{" "}
                        {(item.checks.worstSimilarity * 100).toFixed(2)}%
                        <small>
                          局部分块最低{" "}
                          {(item.checks.worstLocalSimilarity * 100).toFixed(2)}%
                          {" · "}高频文字边缘最低{" "}
                          {(item.checks.worstHighFrequencySimilarity * 100).toFixed(2)}%
                        </small>
                      </dd>
                    </div>
                  </dl>
                )}
                {item.error && (
                  <p className="passport-error" role="alert">
                    {item.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div className="passport-queue-actions">
            <button
              className={`passport-start${isProcessing ? " passport-cancel" : ""}`}
              disabled={!isProcessing && readyCount === 0}
              onClick={isProcessing ? cancelCompression : startCompression}
              type="button"
            >
              {isProcessing
                ? "停止当前处理"
                : `开始压缩并核验${readyCount > 0 ? `（${readyCount} 个）` : ""}`}
            </button>
            <span>处理期间请保持本页打开；文件按顺序逐个处理，避免占用过多内存。</span>
          </div>
          {wechatMode && (
            <p className="wechat-download-hint" role="note">
              {WECHAT_DOWNLOAD_HINT}
            </p>
          )}
        </div>
      )}

      <details className="passport-rules">
        <summary>
          <span>
            <strong>查看压缩与核验规则</strong>
            <small>第 3 页原样保留 · 其他页承担压缩预算 · 不合格即停止</small>
          </span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <ol>
          <li>成品严格不超过 2,900,000 字节，原文件不覆盖、不删除。</li>
          <li>成品文件名增加“_压缩_2.9MB内”；同名成品已存在时自动编号。</li>
          <li>不改动姓名、护照号、日期、照片、签名、机读码或签证记录。</li>
          <li>不删、增、换、裁、转、重排或合并页面，保留页面框与方向。</li>
          <li>第 3 页直接复制原始 PDF 页面，不重新编码或二次压缩。</li>
          <li>压缩预算只从其他页节省，并设置最低可读质量档位。</li>
          <li>尽量复制原件标题、作者、主题、关键词、日期等常用元数据。</li>
          <li>成品重新打开逐页渲染，核对页数、顺序、尺寸、方向和内容。</li>
          <li>第 3 页逐像素比对并计算 SHA-256；任何差异都拒绝保存。</li>
          <li>其他页同时检查整页、局部分块与高频文字边缘；任何一道不达标都拒绝保存。</li>
          <li>交互表单、批注、数字签名及 CropBox/MediaBox 不一致的待重编码页面会安全拒绝。</li>
          <li>原文件、页数、页面像素和编码内存均设安全上限；按质量档逐页释放，可随时停止。</li>
        </ol>
        <p>
          自动核验通过后仍建议提交前人工快速浏览成品；带密码、已损坏或结构异常的 PDF 会停止处理。
        </p>
      </details>
    </section>
  );
}
