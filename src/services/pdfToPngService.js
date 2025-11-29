import fs from "fs";
import path from "path";
import sharp from "sharp";
import * as pdfjs from "pdfjs-dist/build/pdf.mjs";

export async function convertPdfPageToPng(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));

  // Load PDF
  const pdf = await pdfjs.getDocument({ data }).promise;

  // Get first page
  const page = await pdf.getPage(1);

  // Scale (2 = double resolution for better OCR)
  const viewport = page.getViewport({ scale: 2 });

  // OffscreenCanvas WORKS in Node 22
  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");

  // Render into canvas
  await page.render({
    canvasContext: ctx,
    viewport: viewport,
  }).promise;

  // Extract pixels
  const imageData = ctx.getImageData(
    0,
    0,
    viewport.width,
    viewport.height
  );

  // Convert raw RGBA → PNG
  const pngBuffer = await sharp(Buffer.from(imageData.data), {
    raw: {
      width: viewport.width,
      height: viewport.height,
      channels: 4,
    }
  }).png().toBuffer();

  // Save PNG file
  const outputPath = path.join(
    path.dirname(pdfPath),
    path.basename(pdfPath).replace(".pdf", "_page1.png")
  );

  await fs.promises.writeFile(outputPath, pngBuffer);

  return outputPath;
}
