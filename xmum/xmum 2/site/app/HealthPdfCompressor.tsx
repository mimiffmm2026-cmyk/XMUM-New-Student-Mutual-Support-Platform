"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { PDFDocument as PdfLibDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  assertDocumentRenderBudget,
  assertInputFileBudget,
  assertRasterizationSafe,
  closeCanvas,
  compareGeometry,
  compareRenderedPages,
  copyMetadata,
  copyPageGeometry,
  createQueueId,
  encodePagesAtQuality,
  formatBytes,
  inspectPdfStructures,
  isPdfFile,
  loadPdfJs,
  loadPdfLib,
  openPdfJsDocument,
  renderPage,
  saveToDirectory,
  throwIfCancelled,
  type CancellationCheck,
  type DirectoryHandleLike,
  type PdfJsModule,
  type PdfLibModule,
} from "./PassportPdfCompressor";

const HEALTH_LIMIT_BYTES = 500_000;
const HEALTH_MAX_BYTES = HEALTH_LIMIT_BYTES - 1;
const HEALTH_OUTPUT_FOLDER = "健康表_500KB内";
const HEALTH_VALIDATION_SCALE = 1;
const MAX_HEALTH_ENCODED_BYTES = 6_000_000;
const MAX_HEALTH_INPUT_BYTES = 30_000_000;
const MAX_HEALTH_PAGES = 24;
const MAX_HEALTH_TOTAL_RENDER_PIXELS = 28_000_000;

type HealthCompressionPreset = {
  label: string;
  scale: number;
  qualities: number[];
};

type HealthCompressionCheck = {
  pageCount: number;
  renderedPages: number;
  worstSimilarity: number;
  worstLocalSimilarity: number;
  worstHighFrequencySimilarity: number;
  originalSize: number;
  outputSize: number;
  usedOriginalBytes: boolean;
};

type HealthCompressionOutput = {
  bytes: Uint8Array;
  checks: HealthCompressionCheck;
};

type HealthQueueItem = {
  id: string;
  file: File;
  outputName: string;
  outputDirectory?: DirectoryHandleLike;
  outputFolderName?: string;
  status: "ready" | "processing" | "success" | "error";
  progress: string;
  downloadUrl?: string;
  checks?: HealthCompressionCheck;
  error?: string;
};

const healthCompressionPresets: HealthCompressionPreset[] = [
  {
    label: "高清文字",
    scale: 1.6,
    qualities: [0.82, 0.74, 0.66, 0.58],
  },
  {
    label: "清晰",
    scale: 1.35,
    qualities: [0.64, 0.56, 0.48],
  },
  {
    label: "节省空间",
    scale: 1.1,
    qualities: [0.5, 0.44],
  },
];

async function buildHealthPdf(
  pdfLib: PdfLibModule,
  source: PdfLibDocument,
  encodedPages: Map<number, Uint8Array>,
) {
  const output = await pdfLib.PDFDocument.create({ updateMetadata: false });
  copyMetadata(source, output);

  for (
    let pageIndex = 0;
    pageIndex < source.getPageCount();
    pageIndex += 1
  ) {
    const sourcePage = source.getPage(pageIndex);
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

async function verifyHealthOutput(
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
  if (outputBytes.byteLength >= HEALTH_LIMIT_BYTES) {
    throw new Error(
      `成品为 ${outputBytes.byteLength.toLocaleString("zh-CN")} 字节，未达到“小于 500 KB”的要求，已停止保存。`,
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

    const sourcePages = sourceLibDocument.getPages();
    const outputPages = outputLibDocument.getPages();
    let worstSimilarity = 1;
    let worstLocalSimilarity = 1;
    let worstHighFrequencySimilarity = 1;

    for (
      let pageIndex = 0;
      pageIndex < sourceJsDocument.numPages;
      pageIndex += 1
    ) {
      throwIfCancelled(shouldCancel);
      reportProgress(
        `正在逐页核验 ${pageIndex + 1}/${sourceJsDocument.numPages}`,
      );
      if (!compareGeometry(sourcePages[pageIndex], outputPages[pageIndex])) {
        throw new Error(
          `核验失败：第 ${pageIndex + 1} 页的尺寸、页面框或旋转方向发生变化。`,
        );
      }

      const [sourcePage, outputPage] = await Promise.all([
        sourceJsDocument.getPage(pageIndex + 1),
        outputJsDocument.getPage(pageIndex + 1),
      ]);
      const [sourceCanvas, outputCanvas] = await Promise.all([
        renderPage(sourcePage, HEALTH_VALIDATION_SCALE),
        renderPage(outputPage, HEALTH_VALIDATION_SCALE),
      ]);

      try {
        const comparison = compareRenderedPages(
          sourceCanvas,
          outputCanvas,
          false,
        );
        if (comparison.similarity === 0) {
          throw new Error(
            `核验失败：第 ${pageIndex + 1} 页疑似黑页、内容缺失或与原件差异过大（局部分块 ${(comparison.localSimilarity * 100).toFixed(2)}%，高频边缘 ${(comparison.highFrequencySimilarity * 100).toFixed(2)}%）。`,
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
      originalSize: originalBytes.byteLength,
      outputSize: outputBytes.byteLength,
      usedOriginalBytes,
    } satisfies HealthCompressionCheck;
  } finally {
    await outputJsDocument.destroy();
  }
}

async function compressHealthPdf(
  file: File,
  reportProgress: (message: string) => void,
  shouldCancel?: CancellationCheck,
): Promise<HealthCompressionOutput> {
  assertInputFileBudget(file, MAX_HEALTH_INPUT_BYTES, "健康表 PDF ");
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
      sourceJsDocument.numPages < 1 ||
      sourceLibDocument.getPageCount() !== sourceJsDocument.numPages
    ) {
      throw new Error("PDF 页树不完整或没有可处理页面。");
    }
    await assertDocumentRenderBudget(
      sourceJsDocument,
      {
        label: "健康表 PDF ",
        maxPages: MAX_HEALTH_PAGES,
        maxTotalPixels: MAX_HEALTH_TOTAL_RENDER_PIXELS,
        requestedScale: healthCompressionPresets[0].scale,
      },
      shouldCancel,
    );
    const structureInspection = inspectPdfStructures(
      pdfLib,
      sourceLibDocument,
    );

    let outputBytes: Uint8Array;
    let usedOriginalBytes = false;

    if (originalBytes.byteLength < HEALTH_LIMIT_BYTES) {
      reportProgress("原文件已小于 500 KB，保留全部原始字节");
      outputBytes = originalBytes.slice(0);
      usedOriginalBytes = true;
    } else {
      const pageIndexes = Array.from(
        { length: sourceJsDocument.numPages },
        (_, pageIndex) => pageIndex,
      );
      assertRasterizationSafe(
        pdfLib,
        sourceLibDocument,
        pageIndexes,
        structureInspection,
      );
      outputBytes = new Uint8Array();
      let builtCandidate = false;

      for (const preset of healthCompressionPresets) {
        for (const quality of preset.qualities) {
          throwIfCancelled(shouldCancel);
          reportProgress(`正在按“${preset.label}”档逐页压缩`);
          const pass = await encodePagesAtQuality(
            sourceJsDocument,
            pageIndexes,
            preset.scale,
            quality,
            MAX_HEALTH_ENCODED_BYTES,
            reportProgress,
            "正在压缩页面",
            shouldCancel,
          );
          if (!pass) {
            continue;
          }
          const estimatedBytes = 18_000 + pass.encodedBytes;
          if (estimatedBytes > HEALTH_MAX_BYTES) {
            pass.encodedPages.clear();
            continue;
          }

          reportProgress(
            `正在封装 PDF（${preset.label} · 质量 ${Math.round(
              quality * 100,
            )}%）`,
          );
          const candidate = await buildHealthPdf(
            pdfLib,
            sourceLibDocument,
            pass.encodedPages,
          );
          pass.encodedPages.clear();
          if (candidate.byteLength <= HEALTH_MAX_BYTES) {
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
          "在保证文字、证件号码和签名清晰的安全档位内，无法压到 500 KB 以下；未生成成品。",
        );
      }
    }

    reportProgress("正在打开成品并执行逐页核验");
    const checks = await verifyHealthOutput(
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

function chooseOutputFolderName(existingNames: Set<string>) {
  if (!existingNames.has(HEALTH_OUTPUT_FOLDER)) {
    return HEALTH_OUTPUT_FOLDER;
  }
  let copyNumber = 2;
  let candidate = `${HEALTH_OUTPUT_FOLDER}_${copyNumber}`;
  while (existingNames.has(candidate)) {
    copyNumber += 1;
    candidate = `${HEALTH_OUTPUT_FOLDER}_${copyNumber}`;
  }
  return candidate;
}

export default function HealthPdfCompressor() {
  const [items, setItems] = useState<HealthQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [supportsDirectoryPicker, setSupportsDirectoryPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<HealthQueueItem[]>([]);
  const cancelRequestedRef = useRef(false);

  useEffect(() => {
    setSupportsDirectoryPicker(
      typeof window !== "undefined" && "showDirectoryPicker" in window,
    );
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
    outputDirectory?: DirectoryHandleLike,
    outputFolderName?: string,
  ) => {
    const pdfFiles = files.filter(isPdfFile);
    if (pdfFiles.length === 0) {
      return;
    }

    setItems((current) => {
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
        .map((file): HealthQueueItem => {
          const error =
            file.size === 0
              ? "文件为空（0 字节），无法读取或压缩。"
              : file.size > MAX_HEALTH_INPUT_BYTES
                ? `原文件超过 ${formatBytes(MAX_HEALTH_INPUT_BYTES)} 本机安全上限，未加入处理队列。`
                : undefined;
          return {
            id: createQueueId(),
            file,
            outputName: file.name,
            outputDirectory,
            outputFolderName,
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
        if (handle.kind === "file" && handle.name.toLowerCase().endsWith(".pdf")) {
          files.push(await handle.getFile());
        }
      }
      if (files.length === 0) {
        return;
      }
      const outputFolderName = chooseOutputFolderName(existingNames);
      const outputDirectory = await directory.getDirectoryHandle(
        outputFolderName,
        { create: true },
      );
      addFiles(files, outputDirectory, outputFolderName);
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

  const updateItem = (id: string, patch: Partial<HealthQueueItem>) => {
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
        const result = await compressHealthPdf(
          item.file,
          (progress) => {
            updateItem(item.id, { progress });
          },
          () => cancelRequestedRef.current,
        );
        throwIfCancelled(() => cancelRequestedRef.current);
        let downloadUrl: string | undefined;
        let progress: string;

        if (item.outputDirectory) {
          updateItem(item.id, {
            progress: "核验通过，正在写入同名压缩件",
          });
          await saveToDirectory(
            item.outputDirectory,
            item.outputName,
            result.bytes,
          );
          progress = `已保存到 ${item.outputFolderName}/${item.outputName}`;
        } else {
          const stableBytes = new Uint8Array(result.bytes);
          downloadUrl = URL.createObjectURL(
            new Blob([stableBytes.buffer], { type: "application/pdf" }),
          );
          progress = "核验通过，可下载同名压缩件";
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
      className="passport-compressor health-compressor"
      id="health-compressor"
      aria-labelledby="health-compressor-title"
    >
      <div className="passport-compressor-heading">
        <div>
          <span className="local-processing-badge">本机处理 · 不上传</span>
          <h3 id="health-compressor-title">健康表 PDF 压缩</h3>
          <p>
            将每个 PDF 分别压到严格小于 500,000
            字节，保持页数、尺寸、内容和版面一致，并优先保证文字、证件号码和签名清晰。
          </p>
        </div>
        <span className="passport-target health-target">
          严格小于 <strong>500 KB</strong>
        </span>
      </div>

      <div className="passport-guardrail health-guardrail" role="note">
        <strong>同名输出，不覆盖原件</strong>
        <p>
          多文件下载沿用原文件名；选择文件夹时，压缩件会写入新建的“健康表_500KB内”子文件夹，原文件仍保留在原位置。
        </p>
      </div>

      <div className="passport-picker" role="group" aria-label="选择健康表 PDF">
        <label className="passport-picker-primary health-picker-primary">
          <input
            accept="application/pdf,.pdf"
            disabled={isProcessing}
            multiple
            onChange={handleFiles}
            ref={fileInputRef}
            type="file"
          />
          选择一个或多个健康表 PDF
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
            ? "文件夹模式会处理当前层全部 PDF，并在新子文件夹中保留相同文件名。"
            : "当前浏览器不支持文件夹写回；可多选 PDF，完成后逐个下载。"}
        </span>
      </div>

      {items.length > 0 && (
        <div className="passport-queue health-queue" aria-live="polite">
          <div className="passport-queue-heading">
            <strong>待处理健康表（{items.length}）</strong>
            <button disabled={isProcessing} onClick={clearQueue} type="button">
              清空
            </button>
          </div>
          <ul>
            {items.map((item) => (
              <li
                className={`passport-file health-file passport-file-${item.status}`}
                key={item.id}
              >
                <div className="passport-file-main">
                  <strong>{item.file.name}</strong>
                  <span>
                    压缩件沿用原名称
                    {item.outputFolderName
                      ? ` · 输出到 ${item.outputFolderName}`
                      : ""}
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
                      下载同名压缩件
                    </a>
                  )}
                </div>
                {item.checks && (
                  <dl className="passport-checks health-checks">
                    <div>
                      <dt>压缩前</dt>
                      <dd>
                        {formatBytes(item.checks.originalSize)}
                        <small>
                          {item.checks.originalSize.toLocaleString("zh-CN")} 字节
                        </small>
                      </dd>
                    </div>
                    <div>
                      <dt>压缩后</dt>
                      <dd>
                        {formatBytes(item.checks.outputSize)}
                        <small>
                          {item.checks.outputSize.toLocaleString("zh-CN")} 字节 · 小于 500 KB
                        </small>
                      </dd>
                    </div>
                    <div>
                      <dt>逐页核验</dt>
                      <dd>
                        {item.checks.renderedPages}/{item.checks.pageCount} 通过
                        <small>
                          页数、尺寸、页面框、方向一致 · 最低相似度{" "}
                          {(item.checks.worstSimilarity * 100).toFixed(2)}%
                          {" · "}局部分块{" "}
                          {(item.checks.worstLocalSimilarity * 100).toFixed(2)}%
                          {" · "}高频边缘{" "}
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
              className={`passport-start health-start${isProcessing ? " passport-cancel" : ""}`}
              disabled={!isProcessing && readyCount === 0}
              onClick={isProcessing ? cancelCompression : startCompression}
              type="button"
            >
              {isProcessing
                ? "停止当前处理"
                : `开始压缩到 500 KB 以下${readyCount > 0 ? `（${readyCount} 个）` : ""}`}
            </button>
            <span>
              每个文件独立压缩与核验；达不到清晰度和体积双重要求时，该文件会停止处理。
            </span>
          </div>
        </div>
      )}

      <details className="passport-rules health-rules">
        <summary>
          <span>
            <strong>查看健康表压缩规则</strong>
            <small>逐文件小于 500 KB · 同名输出 · 原件保留</small>
          </span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <ol>
          <li>每个成品都必须严格小于 500,000 字节。</li>
          <li>压缩件沿用原文件名，但不覆盖或删除原件。</li>
          <li>页数、顺序、尺寸、页面框与旋转方向保持一致。</li>
          <li>不修改填写内容、证件号码、签名或页面版面。</li>
          <li>优先使用高清文字档位，只有超限时才逐步降低压缩档位。</li>
          <li>成品重新打开并逐页渲染，同时检查整页、局部分块和高频文字边缘。</li>
          <li>若安全档位无法达到限制，停止并不给出模糊成品。</li>
          <li>交互表单、批注、数字签名或 CropBox/MediaBox 不一致时安全拒绝。</li>
          <li>原文件、页数、像素和编码内存设安全上限；逐档逐页释放，可随时停止。</li>
        </ol>
        <p>
          自动核验通过后仍建议提交前人工查看姓名、护照号、日期和签名；带密码、损坏或结构异常的 PDF 会停止处理。
        </p>
      </details>
    </section>
  );
}
