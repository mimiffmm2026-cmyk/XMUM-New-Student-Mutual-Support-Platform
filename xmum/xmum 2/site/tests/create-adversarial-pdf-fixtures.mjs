import { createCanvas } from "@napi-rs/canvas";
import { mkdir, open, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFString,
  rgb,
} from "pdf-lib";

const outputDirectory = path.resolve(
  process.argv[2] ?? "/private/tmp/xmum-adversarial-pdfs",
);
await mkdir(outputDirectory, { recursive: true });

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function createDenseScan() {
  const width = 1_600;
  const height = 2_200;
  const random = seededRandom(20260731);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] = Math.floor(random() * 256);
    image.data[index + 1] = Math.floor(random() * 256);
    image.data[index + 2] = Math.floor(random() * 256);
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  context.fillStyle = "white";
  context.fillRect(70, 70, width - 140, 260);
  context.fillStyle = "#172033";
  context.font = "bold 46px sans-serif";
  context.fillText("SYNTHETIC PDF SAFETY FIXTURE", 105, 155);
  context.font = "28px monospace";
  context.fillText("NO PERSONAL DATA - REGRESSION ONLY", 105, 225);
  context.strokeStyle = "#d52718";
  context.lineWidth = 14;
  context.strokeRect(12, 12, width - 24, height - 24);
  return canvas.toBuffer("image/jpeg", 96);
}

const denseScan = createDenseScan();

async function createLargePdf(configure) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.setTitle("Synthetic adversarial PDF regression fixture");
  const scan = await pdf.embedJpg(denseScan);
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(scan, {
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight(),
    });
    page.drawRectangle({
      x: 3,
      y: 3,
      width: page.getWidth() - 6,
      height: page.getHeight() - 6,
      borderColor: rgb(0.84, 0.08, 0.04),
      borderWidth: 3,
    });
  }
  await configure(pdf);
  return pdf.save({
    addDefaultPage: false,
    updateFieldAppearances: true,
    useObjectStreams: true,
  });
}

async function saveFixture(name, bytes) {
  const outputPath = path.join(outputDirectory, name);
  await writeFile(outputPath, bytes);
  return { name, outputPath, bytes: bytes.byteLength };
}

const fixtures = [];

fixtures.push(
  await saveFixture(
    "passport-cropbox-media-content.pdf",
    await createLargePdf(async (pdf) => {
      const page = pdf.getPage(0);
      page.setCropBox(36, 36, page.getWidth() - 72, page.getHeight() - 72);
    }),
  ),
);

fixtures.push(
  await saveFixture(
    "health-cropbox-media-content.pdf",
    await createLargePdf(async (pdf) => {
      const page = pdf.getPage(1);
      page.setCropBox(42, 42, page.getWidth() - 84, page.getHeight() - 84);
    }),
  ),
);

fixtures.push(
  await saveFixture(
    "health-acroform-widget.pdf",
    await createLargePdf(async (pdf) => {
      const form = pdf.getForm();
      const field = form.createTextField("synthetic_student_name");
      field.setText("SYNTHETIC TEST VALUE");
      field.addToPage(pdf.getPage(0), {
        x: 80,
        y: 660,
        width: 320,
        height: 42,
      });
    }),
  ),
);

fixtures.push(
  await saveFixture(
    "health-page-annotation.pdf",
    await createLargePdf(async (pdf) => {
      const annotation = pdf.context.obj({});
      annotation.set(PDFName.of("Type"), PDFName.of("Annot"));
      annotation.set(PDFName.of("Subtype"), PDFName.of("Text"));
      annotation.set(
        PDFName.of("Rect"),
        pdf.context.obj([40, 40, 120, 120]),
      );
      annotation.set(
        PDFName.of("Contents"),
        PDFString.of("Synthetic annotation - no private content"),
      );
      const annotationRef = pdf.context.register(annotation);
      pdf.getPage(0).node.set(
        PDFName.of("Annots"),
        pdf.context.obj([annotationRef]),
      );
    }),
  ),
);

fixtures.push(
  await saveFixture(
    "health-digital-signature-field.pdf",
    await createLargePdf(async (pdf) => {
      const signatureValue = pdf.context.obj({});
      signatureValue.set(PDFName.of("Type"), PDFName.of("Sig"));
      signatureValue.set(
        PDFName.of("Filter"),
        PDFName.of("Adobe.PPKLite"),
      );
      signatureValue.set(
        PDFName.of("SubFilter"),
        PDFName.of("adbe.pkcs7.detached"),
      );
      signatureValue.set(PDFName.of("Contents"), PDFHexString.of("00"));
      const signatureValueRef = pdf.context.register(signatureValue);

      const signatureField = pdf.context.obj({});
      signatureField.set(PDFName.of("FT"), PDFName.of("Sig"));
      signatureField.set(
        PDFName.of("T"),
        PDFString.of("synthetic_signature"),
      );
      signatureField.set(PDFName.of("V"), signatureValueRef);
      const signatureFieldRef = pdf.context.register(signatureField);

      const acroForm = pdf.context.obj({});
      acroForm.set(
        PDFName.of("Fields"),
        pdf.context.obj([signatureFieldRef]),
      );
      acroForm.set(PDFName.of("SigFlags"), pdf.context.obj(3));
      const acroFormRef = pdf.context.register(acroForm);
      pdf.catalog.set(PDFName.of("AcroForm"), acroFormRef);
    }),
  ),
);

for (const [name, pageCount] of [
  ["passport-page-limit.pdf", 41],
  ["health-page-limit.pdf", 25],
]) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    pdf.addPage([200, 200]);
  }
  fixtures.push(
    await saveFixture(
      name,
      await pdf.save({ addDefaultPage: false, useObjectStreams: true }),
    ),
  );
}

{
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.addPage([12_001, 100]);
  fixtures.push(
    await saveFixture(
      "health-pixel-limit.pdf",
      await pdf.save({ addDefaultPage: false, useObjectStreams: true }),
    ),
  );
}

fixtures.push(await saveFixture("empty.pdf", new Uint8Array()));

{
  const outputPath = path.join(outputDirectory, "oversize-input.pdf");
  const handle = await open(outputPath, "w");
  try {
    await handle.truncate(45_000_001);
  } finally {
    await handle.close();
  }
  fixtures.push({
    name: "oversize-input.pdf",
    outputPath,
    bytes: 45_000_001,
  });
}

console.log(JSON.stringify({ outputDirectory, fixtures }, null, 2));
