import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

import { connectDB } from "./src/config/db.js";
import { downloadFile } from "./src/services/fileService.js";
import { ocrFromImage } from "./src/ocr/tesseractFallback.js";
import { extractJsonFromOcr } from "./src/parser/llmExtractor.js";

dotenv.config();


let __dirname = path.dirname(decodeURI(new URL(import.meta.url).pathname));
if (process.platform === "win32" && __dirname.startsWith("/")) {
  __dirname = __dirname.slice(1);
}

const app = express();
app.use(bodyParser.json({ limit: "15mb" }));

const PORT = process.env.PORT || 3000;

// Mongo client
let db;
connectDB()
  .then((client) => {
    db = client.db(process.env.DB_NAME || "invoice_extractor");
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB connection failed", err);
  });

  //route
app.post("/extract-bill-data", async (req, res) => {
  try {
    const { document } = req.body;
    if (!document) return res.status(400).json({ error: "document URL required" });

    if (!db) {
      return res
        .status(500)
        .json({ is_success: false, error: "DB not connected yet. Try again." });
    }

    const jobId = uuidv4();
    const tmpDir = path.join(__dirname, "tmp");

    
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const tmpFile = path.join(tmpDir, `${jobId}.png`);
    const invoices = db.collection("invoices");

    
    const job = {
      job_id: jobId,
      input_url: document,
      status: "processing",
      created_at: new Date(),
    };
    const inserted = await invoices.insertOne(job);

    // download invoice
    await downloadFile(document, tmpFile);

    // ---- OCR step (Tesseract) ----
    let ocrText;
    try {
      ocrText = await ocrFromImage(tmpFile);
    } catch (err) {
      console.error("OCR failed:", err);
      await invoices.updateOne(
        { _id: inserted.insertedId },
        { $set: { status: "error", error: "OCR failed", updated_at: new Date() } }
      );
      fs.unlinkSync(tmpFile);
      return res.status(500).json({ is_success: false, error: "OCR failed" });
    }

    // store raw OCR text
    await invoices.updateOne(
      { _id: inserted.insertedId },
      { $set: { raw_ocr_text: ocrText } }
    );

    // ---- LLM extraction step (structured JSON) ----
    let finalParsed;
    try {
      finalParsed = await extractJsonFromOcr(ocrText);
    } catch (err) {
      console.error("LLM extractor failed:", err);
      await invoices.updateOne(
        { _id: inserted.insertedId },
        { $set: { status: "error", error: "LLM extraction failed", updated_at: new Date() } }
      );
      fs.unlinkSync(tmpFile);
      return res.status(500).json({ is_success: false, error: "LLM extraction failed" });
    }

    // update DB
    await invoices.updateOne(
      { _id: inserted.insertedId },
      { $set: { ...finalParsed, status: "done", updated_at: new Date() } }
    );

    // clean up local file
    try {
      fs.unlinkSync(tmpFile);
    } catch (e) {
      // ignore
    }

    // final API response
    return res.json({
      is_success: true,
      token_usage: finalParsed.token_usage || { total_tokens: 0, input_tokens: 0, output_tokens: 0 },
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));









// import express from "express";
// import bodyParser from "body-parser";
// import dotenv from "dotenv";
// import { v4 as uuidv4 } from "uuid";
// import path from "path";
// import fs from "fs";

// import { connectDB } from "./src/config/db.js";
// import { downloadFile, uploadToS3 } from "./src/services/fileService.js";

// // Textract + fallback
// import { callTextract } from "./src/ocr/textract.js";
// import { tesseractOCR } from "./src/ocr/tesseractFallback.js";

// // Parsing logic
// import { parseTextractResponse } from "./src/parser/parseTextract.js";
// import { detectTotalsAndDedupe } from "./src/parser/detectTotals.js";

// dotenv.config();

// // ---------- FIX: Correct Windows-safe __dirname ----------
// const __dirname = path.resolve();

// // ---------------------------------------------------------

// const app = express();
// app.use(bodyParser.json({ limit: "10mb" }));

// const PORT = process.env.PORT || 3000;

// // ---------- MongoDB Connection ----------
// let db;
// connectDB().then((client) => {
//   db = client.db(process.env.DB_NAME);
//   console.log("MongoDB connected");
// });

// /**
//  * ================================================
//  *           POST /extract-bill-data
//  * ================================================
//  */
// app.post("/extract-bill-data", async (req, res) => {
//   try {
//     const { document } = req.body;

//     if (!document) {
//       return res.status(400).json({ error: "document URL required" });
//     }

//     // Job ID
//     const jobId = uuidv4();

//     // ---------- FIX: Correct tmp directory creation ----------
//     const tmpPath = path.join(__dirname, "tmp");
//     if (!fs.existsSync(tmpPath)) {
//       fs.mkdirSync(tmpPath, { recursive: true });
//     }
//     // ---------------------------------------------------------

//     const localFile = path.join(tmpPath, `${jobId}.png`);

//     const invoices = db.collection("invoices");

//     // Create job entry
//     const job = {
//       job_id: jobId,
//       input_url: document,
//       status: "processing",
//       created_at: new Date(),
//     };

//     const inserted = await invoices.insertOne(job);

//     // Download file
//     await downloadFile(document, localFile);

//     // Optional S3 upload
//     if (process.env.S3_BUCKET) {
//       const key = `uploads/${jobId}.png`;
//       const s3path = await uploadToS3(localFile, process.env.S3_BUCKET, key);

//       await invoices.updateOne(
//         { _id: inserted.insertedId },
//         { $set: { s3_path: s3path } }
//       );
//     }

//     // ---------------- OCR PROCESS ----------------
//     let rawOcr = null;

//     try {
//       rawOcr = await callTextract(localFile);
//     } catch (err) {
//       console.log("Textract failed → using Tesseract fallback");
//       rawOcr = await tesseractOCR(localFile);
//     }

//     // Store raw OCR
//     await invoices.updateOne(
//       { _id: inserted.insertedId },
//       { $set: { raw_ocr: rawOcr } }
//     );

//     // Parse extracted text
//     const parsedPages = parseTextractResponse(rawOcr);

//     // Detect totals & remove duplicates
//     const finalParsed = detectTotalsAndDedupe(parsedPages);

//     // Update DB
//     await invoices.updateOne(
//       { _id: inserted.insertedId },
//       {
//         $set: {
//           ...finalParsed,
//           status: "done",
//           updated_at: new Date(),
//         },
//       }
//     );

//     // API Response
//     return res.json({
//       is_success: true,
//       token_usage: {
//         total_tokens: 0,
//         input_tokens: 0,
//         output_tokens: 0,
//       },
//       data: {
//         pagewise_line_items: finalParsed.pagewise_line_items,
//         total_item_count: finalParsed.total_item_count,
//       },
//     });
//   } catch (err) {
//     console.error("SERVER ERROR:", err.message);
//     return res.status(500).json({
//       is_success: false,
//       error: err.message,
//     });
//   }
// });

// // ---------- Start server ----------
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });






