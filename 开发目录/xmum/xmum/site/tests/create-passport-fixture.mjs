import { createCanvas } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";
import { degrees, PDFDocument, rgb } from "pdf-lib";

const oversizedProfile = process.argv.includes("--oversized-profile");
const outputPath =
  process.argv.slice(2).find((argument) => !argument.startsWith("--")) ??
  "/private/tmp/passport-compressor-fixture.pdf";
const pageCount = oversizedProfile ? 4 : 26;
const standardImageWidth = 700;
const standardImageHeight = 980;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function createSyntheticScan(pageNumber) {
  const imageWidth =
    oversizedProfile && pageNumber === 3 ? 2_200 : standardImageWidth;
  const imageHeight =
    oversizedProfile && pageNumber === 3 ? 3_000 : standardImageHeight;
  const random = seededRandom(20260730 + pageNumber * 17);
  const canvas = createCanvas(imageWidth, imageHeight);
  const context = canvas.getContext("2d");
  const pixels = new Uint8ClampedArray(imageWidth * imageHeight * 4);

  for (let y = 0; y < imageHeight; y += 1) {
    for (let x = 0; x < imageWidth; x += 1) {
      const index = (y * imageWidth + x) * 4;
      const paper = 214 + Math.round(30 * (x / imageWidth));
      const texture =
        oversizedProfile && pageNumber === 3
          ? Math.floor(random() * 256) - 128
          : Math.floor(random() * 20) - 10;
      const wave = Math.round(
        15 * Math.sin((x + pageNumber * 23) / 33) +
          11 * Math.cos((y + pageNumber * 19) / 41),
      );
      pixels[index] = Math.max(0, Math.min(255, paper + texture + wave));
      pixels[index + 1] = Math.max(
        0,
        Math.min(255, paper + texture - wave / 2),
      );
      pixels[index + 2] = Math.max(
        0,
        Math.min(255, paper + texture / 2 + wave),
      );
      pixels[index + 3] = 255;
    }
  }

  const imageData = context.createImageData(imageWidth, imageHeight);
  imageData.data.set(pixels);
  context.putImageData(imageData, 0, 0);
  context.fillStyle = "rgba(18, 31, 50, 0.9)";
  context.font = "bold 44px sans-serif";
  context.fillText(
    pageNumber === 3 ? "PROFILE PAGE 3 - KEEP EXACT" : `VISA RECORD PAGE ${pageNumber}`,
    54,
    88,
  );
  context.font = "24px monospace";
  for (let row = 0; row < 18; row += 1) {
    context.fillText(
      `SYNTHETIC TEST DATA ${pageNumber}-${String(row + 1).padStart(2, "0")}  ABC123456789`,
      64,
      145 + row * 42,
    );
  }
  context.strokeStyle = pageNumber === 3 ? "#b83f21" : "#263149";
  context.lineWidth = 7;
  context.strokeRect(42, 35, imageWidth - 84, imageHeight - 70);

  if (pageNumber === 3) {
    context.fillStyle = "#f6eee7";
    context.fillRect(imageWidth - 245, 125, 190, 250);
    context.fillStyle = "#23334f";
    context.beginPath();
    context.arc(imageWidth - 150, 205, 58, 0, Math.PI * 2);
    context.fill();
    context.fillRect(imageWidth - 210, 270, 120, 78);
    context.font = "bold 22px monospace";
    context.fillText("P<TESTSYNTHETIC<<<<<<<<<<<<", 62, imageHeight - 88);
    context.fillText("X00000000<0TST0000000M0000000", 62, imageHeight - 48);
  }

  return canvas.toBuffer("image/jpeg", 96);
}

const pdf = await PDFDocument.create({ updateMetadata: false });
pdf.setTitle("Synthetic passport compressor regression fixture");
pdf.setAuthor("Codex browser regression");

for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
  const page = pdf.addPage([595.28, 841.89]);
  const scan = await pdf.embedJpg(createSyntheticScan(pageNumber));
  page.drawImage(scan, {
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  });
  page.drawRectangle({
    x: 18,
    y: 18,
    width: 10,
    height: 10,
    color: rgb(0.75, 0.15, 0.08),
  });
  if (!oversizedProfile && pageNumber === 4) {
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
    exceedsTarget: bytes.byteLength > 2_900_000,
    oversizedProfile,
  }),
);
