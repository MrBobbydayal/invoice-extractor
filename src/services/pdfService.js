import { fromPath } from "pdf2pic";
import path from "path";

export async function convertPdfToPng(pdfPath) {
  const outputDir = path.dirname(pdfPath);

  const converter = fromPath(pdfPath, {
    density: 150,
    format: "png",
    width: 1200,
    height: 1600,
    savePath: outputDir,
  });

  const result = await converter(1); // Convert only first page
  return result.path;               // Return PNG filepath
}
