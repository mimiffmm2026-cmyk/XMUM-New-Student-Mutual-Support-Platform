import { createCanvas } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";
import { degrees, PDFDocument } from "pdf-lib";

const impossible = process.argv.includes("--impossible");
const outputPath =
  process.argv.slice(2).find((argument) => !argument.startsWith("--")) ??
  "/private/tmp/health-form-compressor-fixture.pdf";
const pageCount = impossible ? 8 : 2;
const imageWidth = impossible ? 1_250 : 1_150;
const imageHeight = impossible ? 1_750 : 1_600;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1103515245 + 12345) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function createHealthFormPage(pageNumber) {
  const random = seededRandom(500_000 + pageNumber * 97);
  const canvas = createCanvas(imageWidth, imageHeight);
  const context = canvas.getContext("2d");
  const imageData = context.createImageData(imageWidth, imageHeight);

  for (let y = 0; y < imageHeight; y += 1) {
    for (let x = 0; x < imageWidth; x += 1) {
      const index = (y * imageWidth + x) * 4;
      const base = 226 + Math.round(18 * (x / imageWidth));
      const noiseRange = impossible ? 196 : 112;
      const noise = Math.floor(random() * noiseRange) - noiseRange / 2;
      imageData.data[index] = Math.max(0, Math.min(255, base + noise));
      imageData.data[index + 1] = Math.max(
        0,
        Math.min(255, base + noise * 0.72),
      );
      imageData.data[index + 2] = Math.max(
        0,
        Math.min(255, base + noise * 0.5),
      );
      imageData.data[index + 3] = 255;
    }
  }
  context.putImageData(imageData, 0, 0);

  context.fillStyle = "#172033";
  context.font = "bold 42px sans-serif";
  context.fillText("HEALTH DECLARATION FORM", 62, 78);
  context.font = "24px monospace";
  context.fillText(`PAGE ${pageNumber} / ${pageCount}`, 880, 78);

  const rows = [
    ["FULL NAME", "SYNTHETIC TEST STUDENT"],
    ["PASSPORT NO.", "X12345678"],
    ["DATE OF BIRTH", "01 / 01 / 2008"],
    ["DECLARATION", "NO RELEVANT MEDICAL CONDITION"],
    ["CONTACT", "+60 0000 0000"],
  ];
  context.lineWidth = 3;
  context.strokeStyle = "#263149";
  context.font = "25px sans-serif";
  rows.forEach(([label, value], index) => {
    const y = 170 + index * 150;
    context.strokeRect(62, y, imageWidth - 124, 112);
    context.fillText(label, 82, y + 42);
    context.font = "bold 28px monospace";
    context.fillText(value, 320, y + 72);
    context.font = "25px sans-serif";
  });

  context.fillText("SIGNATURE", 82, 1_080);
  context.strokeRect(62, 1_105, imageWidth - 124, 190);
  context.strokeStyle = "#1c4c78";
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(190, 1_225);
  context.bezierCurveTo(330, 1_090, 410, 1_330, 565, 1_160);
  context.bezierCurveTo(650, 1_070, 720, 1_310, 895, 1_155);
  context.stroke();
  context.fillStyle = "#172033";
  context.font = "22px monospace";
  context.fillText("SIGNED: 30 / 07 / 2026", 700, 1_270);

  context.strokeStyle = "#875b10";
  context.lineWidth = 6;
  context.strokeRect(34, 30, imageWidth - 68, imageHeight - 60);
  return canvas.toBuffer("image/jpeg", 94);
}

const pdf = await PDFDocument.create({ updateMetadata: false });
pdf.setTitle("Synthetic health form compressor regression fixture");
pdf.setAuthor("Codex browser regression");

for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
  const page = pdf.addPage([595.28, 841.89]);
  const image = await pdf.embedJpg(createHealthFormPage(pageNumber));
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  });
  if (!impossible && pageNumber === 2) {
    page.setRotation(degrees(90));
  }
}

const bytes = await pdf.save({
  addDefaultPage: false,
  updateFieldAppearances: false,
  useObjectStreams: true,
});
await writeFile(outputPath, bytes);
console.log(
  JSON.stringify({
    outputPath,
    pageCount,
    bytes: bytes.byteLength,
    exceedsTarget: bytes.byteLength >= 500_000,
    impossible,
  }),
);
