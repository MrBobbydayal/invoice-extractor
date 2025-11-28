import Tesseract from "tesseract.js";
import path from "path";

export async function ocrFromImage(imagePath) {
 
  const result = await Tesseract.recognize(imagePath, "eng", {
   
  });

  return result?.data?.text || "";
}






// import Tesseract from "tesseract.js";

// export async function tesseractOCR(filePath) {
//   const result = await Tesseract.recognize(filePath, "eng", {
//     logger: () => {},
//   });

//   const lines = result.data.lines.map((l) => ({
//     text: l.text,
//     bbox: {
//       left: l.bbox.x0,
//       top: l.bbox.y0,
//       width: l.bbox.x1 - l.bbox.x0,
//       height: l.bbox.y1 - l.bbox.y0,
//     },
//     confidence: l.confidence,
//   }));

//   return [{ page_no: 1, lines }];
// }
