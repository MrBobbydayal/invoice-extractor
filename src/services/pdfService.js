import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParseModule = require("pdf-parse");

export async function extractTextFromPdf(pdfPath) {
  const data = fs.readFileSync(pdfPath);

  const parse =
    (typeof pdfParseModule === "function" && pdfParseModule) ||
    (pdfParseModule.default &&
      typeof pdfParseModule.default === "function" &&
      pdfParseModule.default) ||
    null;

  if (!parse) {
    throw new Error("pdf-parse module could not load");
  }

  const result = await parse(data);
  return result.text || "";
}








// import fs from "fs";
// import { createRequire } from "module";

// const require = createRequire(import.meta.url);
// const pdfParseModule = require("pdf-parse");

// export async function extractTextFromPdf(pdfPath) {
//   const dataBuffer = fs.readFileSync(pdfPath);

//   // Try all export shapes
//   const parse =
//     (typeof pdfParseModule === "function" && pdfParseModule) ||
//     (pdfParseModule.default &&
//       typeof pdfParseModule.default === "function" &&
//       pdfParseModule.default) ||
//     null;

//   if (!parse) {
//     console.log("DEBUG pdfParseModule =", pdfParseModule);
//     throw new Error("Could not load pdf-parse function");
//   }

//   const result = await parse(dataBuffer);
//   return result.text;
// }
