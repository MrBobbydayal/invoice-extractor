import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { convertPdfToPng } from "./src/services/pdfService.js";
import { downloadFile } from "./src/services/fileService.js";

import { connectDB } from "./src/config/db.js";
import { ocrFromImage } from "./src/ocr/tesseractFallback.js";
import { extractJsonFromOcr } from "./src/parser/llmExtractor.js";

dotenv.config();

// Windows path fix
let __dirname = path.dirname(decodeURI(new URL(import.meta.url).pathname));
if (process.platform === "win32" && __dirname.startsWith("/")) {
  __dirname = __dirname.slice(1);
}

const app = express();
app.use(bodyParser.json({ limit: "15mb" }));

const PORT = process.env.PORT || 3000;

// DB connection
let db;
connectDB()
  .then((client) => {
    db = client.db(process.env.DB_NAME || "invoice_extractor");
    console.log("MongoDB connected");
  })
  .catch((err) => console.error("MongoDB connection failed", err));

/************************ MAIN ROUTE *************************/
app.post("/extract-bill-data", async (req, res) => {
  try {
    const { document } = req.body;
    if (!document) {
      return res.status(400).json({ error: "document URL required" });
    }

    if (!db) {
      return res.status(500).json({
        is_success: false,
        error: "DB not connected yet. Try again.",
      });
    }

    const jobId = uuidv4();
    const tmpDir = path.join(__dirname, "tmp");

    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    // Base temporary path (extension added by service)
    const baseTempPath = path.join(tmpDir, jobId);

    /***** Step 1: Download file (Auto detect: PDF / Image) ******/
    const { filePath: downloadedFile, ext } = await downloadFile(
      document,
      baseTempPath
    );

    const isPdf = ext === ".pdf";

    let finalImagePath = "";

    /**************** DB JOB ENTRY ******************/
    const invoices = db.collection("invoices");

    const job = {
      job_id: jobId,
      input_url: document,
      status: "processing",
      created_at: new Date(),
    };
    const inserted = await invoices.insertOne(job);

    /**************** STEP 2: Convert PDF → PNG or Normalize Image ******************/
    if (isPdf) {
      console.log("PDF detected → converting to PNG...");
      finalImagePath = await convertPdfToPng(downloadedFile);
    } else {
      console.log("Image detected → normalizing to PNG...");

      // Save as different PNG file to avoid same input/output
      const tempPng = baseTempPath + "_converted.png";

      await sharp(downloadedFile).png().toFile(tempPng);

      finalImagePath = tempPng;
    }

    /**************** STEP 3: OCR ******************/
    let ocrText;
    try {
      ocrText = await ocrFromImage(finalImagePath);
    } catch (err) {
      console.error("OCR failed:", err);

      await invoices.updateOne(
        { _id: inserted.insertedId },
        {
          $set: {
            status: "error",
            error: "OCR failed",
            updated_at: new Date(),
          },
        }
      );

      return res.status(500).json({ is_success: false, error: "OCR failed" });
    }

    await invoices.updateOne(
      { _id: inserted.insertedId },
      { $set: { raw_ocr_text: ocrText } }
    );

    /**************** STEP 4: LLM JSON parsing ******************/
    let finalParsed;
    try {
      finalParsed = await extractJsonFromOcr(ocrText);
    } catch (err) {
      console.error("LLM extractor failed:", err);

      await invoices.updateOne(
        { _id: inserted.insertedId },
        {
          $set: {
            status: "error",
            error: "LLM extraction failed",
            updated_at: new Date(),
          },
        }
      );

      return res.status(500).json({
        is_success: false,
        error: "LLM extraction failed",
      });
    }

    /**************** STEP 5: Save Result ******************/
    await invoices.updateOne(
      { _id: inserted.insertedId },
      {
        $set: {
          ...finalParsed,
          status: "done",
          updated_at: new Date(),
        },
      }
    );

    /**************** CLEANUP ******************/
    try {
      if (fs.existsSync(downloadedFile)) fs.unlinkSync(downloadedFile);
      if (fs.existsSync(finalImagePath)) fs.unlinkSync(finalImagePath);
    } catch {}

    /**************** FINAL RESPONSE ******************/
    return res.json({
      is_success: true,
      token_usage: finalParsed.token_usage || {
        total_tokens: 0,
        input_tokens: 0,
        output_tokens: 0,
      },
      data: {
        pagewise_line_items: finalParsed.pagewise_line_items,
        total_item_count: finalParsed.total_item_count || 0,
      },
    });
  } catch (err) {
    console.error("ERROR:", err);

    return res.status(500).json({
      is_success: false,
      error: err.message || String(err),
    });
  }
});

/*********************** START SERVER *************************/
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));












// import express from "express";
// import bodyParser from "body-parser";
// import dotenv from "dotenv";
// import { v4 as uuidv4 } from "uuid";
// import path from "path";
// import fs from "fs";

// import { connectDB } from "./src/config/db.js";
// import { downloadFile } from "./src/services/fileService.js";
// import { ocrFromImage } from "./src/ocr/tesseractFallback.js";
// import { extractJsonFromOcr } from "./src/parser/llmExtractor.js";

// dotenv.config();


// let __dirname = path.dirname(decodeURI(new URL(import.meta.url).pathname));
// if (process.platform === "win32" && __dirname.startsWith("/")) {
//   __dirname = __dirname.slice(1);
// }

// const app = express();
// app.use(bodyParser.json({ limit: "15mb" }));

// const PORT = process.env.PORT || 3000;

// // Mongo client
// let db;
// connectDB()
//   .then((client) => {
//     db = client.db(process.env.DB_NAME || "invoice_extractor");
//     console.log("MongoDB connected");
//   })
//   .catch((err) => {
//     console.error("MongoDB connection failed", err);
//   });

//   //route
// app.post("/extract-bill-data", async (req, res) => {
//   try {
//     const { document } = req.body;
//     if (!document) return res.status(400).json({ error: "document URL required" });

//     if (!db) {
//       return res
//         .status(500)
//         .json({ is_success: false, error: "DB not connected yet. Try again." });
//     }

//     const jobId = uuidv4();
//     const tmpDir = path.join(__dirname, "tmp");

    
//     if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

//     const tmpFile = path.join(tmpDir, `${jobId}.png`);
//     const invoices = db.collection("invoices");

    
//     const job = {
//       job_id: jobId,
//       input_url: document,
//       status: "processing",
//       created_at: new Date(),
//     };
//     const inserted = await invoices.insertOne(job);

//     // download invoice
//     await downloadFile(document, tmpFile);

//     // ---- OCR step (Tesseract) ----
//     let ocrText;
//     try {
//       ocrText = await ocrFromImage(tmpFile);
//     } catch (err) {
//       console.error("OCR failed:", err);
//       await invoices.updateOne(
//         { _id: inserted.insertedId },
//         { $set: { status: "error", error: "OCR failed", updated_at: new Date() } }
//       );
//       fs.unlinkSync(tmpFile);
//       return res.status(500).json({ is_success: false, error: "OCR failed" });
//     }

//     // store raw OCR text
//     await invoices.updateOne(
//       { _id: inserted.insertedId },
//       { $set: { raw_ocr_text: ocrText } }
//     );

//     // ---- LLM extraction step (structured JSON) ----
//     let finalParsed;
//     try {
//       finalParsed = await extractJsonFromOcr(ocrText);
//     } catch (err) {
//       console.error("LLM extractor failed:", err);
//       await invoices.updateOne(
//         { _id: inserted.insertedId },
//         { $set: { status: "error", error: "LLM extraction failed", updated_at: new Date() } }
//       );
//       fs.unlinkSync(tmpFile);
//       return res.status(500).json({ is_success: false, error: "LLM extraction failed" });
//     }

//     // update DB
//     await invoices.updateOne(
//       { _id: inserted.insertedId },
//       { $set: { ...finalParsed, status: "done", updated_at: new Date() } }
//     );

//     // clean up local file
//     try {
//       fs.unlinkSync(tmpFile);
//     } catch (e) {
//       // ignore
//     }

//     // final API response
//     return res.json({
//       is_success: true,
//       token_usage: finalParsed.token_usage || { total_tokens: 0, input_tokens: 0, output_tokens: 0 },
//       data: {
//         pagewise_line_items: finalParsed.pagewise_line_items,
//         total_item_count: finalParsed.total_item_count || 0,
//       },
//     });
//   } catch (err) {
//     console.error("ERROR:", err);
//     return res.status(500).json({
//       is_success: false,
//       error: err.message || String(err),
//     });
//   }
// });

// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));














