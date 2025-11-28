import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

import { connectDB } from "./src/config/db.js";
import { downloadFile, uploadToS3 } from "./src/services/fileService.js";

// Textract + fallback
import { callTextract } from "./src/ocr/textract.js";
import { tesseractOCR } from "./src/ocr/tesseractFallback.js";

// Parsing logic
import { parseTextractResponse } from "./src/parser/parseTextract.js";
import { detectTotalsAndDedupe } from "./src/parser/detectTotals.js";

dotenv.config();

// ---------- FIX: Correct Windows-safe __dirname ----------
const __dirname = path.resolve();

// ---------------------------------------------------------

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

// ---------- MongoDB Connection ----------
let db;
connectDB().then((client) => {
  db = client.db(process.env.DB_NAME);
  console.log("MongoDB connected");
});

/**
 * ================================================
 *           POST /extract-bill-data
 * ================================================
 */
app.post("/extract-bill-data", async (req, res) => {
  try {
    const { document } = req.body;

    if (!document) {
      return res.status(400).json({ error: "document URL required" });
    }

    // Job ID
    const jobId = uuidv4();

    // ---------- FIX: Correct tmp directory creation ----------
    const tmpPath = path.join(__dirname, "tmp");
    if (!fs.existsSync(tmpPath)) {
      fs.mkdirSync(tmpPath, { recursive: true });
    }
    // ---------------------------------------------------------

    const localFile = path.join(tmpPath, `${jobId}.png`);

    const invoices = db.collection("invoices");

    // Create job entry
    const job = {
      job_id: jobId,
      input_url: document,
      status: "processing",
      created_at: new Date(),
    };

    const inserted = await invoices.insertOne(job);

    // Download file
    await downloadFile(document, localFile);

    // Optional S3 upload
    if (process.env.S3_BUCKET) {
      const key = `uploads/${jobId}.png`;
      const s3path = await uploadToS3(localFile, process.env.S3_BUCKET, key);

      await invoices.updateOne(
        { _id: inserted.insertedId },
        { $set: { s3_path: s3path } }
      );
    }

    // ---------------- OCR PROCESS ----------------
    let rawOcr = null;

    try {
      rawOcr = await callTextract(localFile);
    } catch (err) {
      console.log("Textract failed → using Tesseract fallback");
      rawOcr = await tesseractOCR(localFile);
    }

    // Store raw OCR
    await invoices.updateOne(
      { _id: inserted.insertedId },
      { $set: { raw_ocr: rawOcr } }
    );

    // Parse extracted text
    const parsedPages = parseTextractResponse(rawOcr);

    // Detect totals & remove duplicates
    const finalParsed = detectTotalsAndDedupe(parsedPages);

    // Update DB
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

    // API Response
    return res.json({
      is_success: true,
      token_usage: {
        total_tokens: 0,
        input_tokens: 0,
        output_tokens: 0,
      },
      data: {
        pagewise_line_items: finalParsed.pagewise_line_items,
        total_item_count: finalParsed.total_item_count,
      },
    });
  } catch (err) {
    console.error("SERVER ERROR:", err.message);
    return res.status(500).json({
      is_success: false,
      error: err.message,
    });
  }
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});






// import express from "express";
// import bodyParser from "body-parser";
// import dotenv from "dotenv";
// import { v4 as uuidv4 } from "uuid";
// import path from "path";
// import fs from "fs";
// import axios from "axios";

// import { connectDB } from "./src/config/db.js";
// import { downloadFile, uploadToS3 } from "./src/services/fileService.js";
// import { callTextract } from "./src/ocr/textract.js";
// import { tesseractOCR } from "./src/ocr/tesseractFallback.js";
// import { parseTextractResponse } from "./src/parser/parseTextract.js";
// import { detectTotalsAndDedupe } from "./src/parser/detectTotals.js";

// dotenv.config();

// const __dirname = path.dirname(new URL(import.meta.url).pathname);
// const app = express();
// app.use(bodyParser.json({ limit: "10mb" }));

// const PORT = process.env.PORT || 3000;

// // Mongo client
// let db;
// connectDB().then((client) => {
//   db = client.db(process.env.DB_NAME);
//   console.log("MongoDB connected");
// });

// /**
//  * POST /extract-bill-data
//  */
// app.post("/extract-bill-data", async (req, res) => {
//   try {
//     const { document } = req.body;
//     if (!document)
//       return res.status(400).json({ error: "document URL required" });

//     const jobId = uuidv4();
//     const tmpPath = path.join(__dirname, "tmp");
//     if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);

//     const localFile = path.join(tmpPath, `${jobId}.png`);

//     const invoices = db.collection("invoices");

//     // create job entry
//     const job = {
//       job_id: jobId,
//       input_url: document,
//       status: "processing",
//       created_at: new Date(),
//     };
//     const inserted = await invoices.insertOne(job);

//     // download document
//     await downloadFile(document, localFile);

//     // OPTIONAL: Upload to S3
//     if (process.env.S3_BUCKET) {
//       const key = `uploads/${jobId}.png`;
//       const s3path = await uploadToS3(localFile, process.env.S3_BUCKET, key);
//       await invoices.updateOne(
//         { _id: inserted.insertedId },
//         { $set: { s3_path: s3path } }
//       );
//     }

//     // Try Textract first
//     let rawOcr = null;

//     try {
//       rawOcr = await callTextract(localFile);
//     } catch (err) {
//       console.log("Textract failed → using Tesseract fallback");
//       rawOcr = await tesseractOCR(localFile);
//     }

//     // store raw OCR
//     await invoices.updateOne(
//       { _id: inserted.insertedId },
//       { $set: { raw_ocr: rawOcr } }
//     );

//     // parse blocks → extract rows
//     const parsedPages = parseTextractResponse(rawOcr);

//     // detect totals + dedupe
//     const finalParsed = detectTotalsAndDedupe(parsedPages);

//     // update DB
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

//     // final API response
//     return res.json({
//       is_success: true,
//       token_usage: { total_tokens: 0, input_tokens: 0, output_tokens: 0 },
//       data: {
//         pagewise_line_items: finalParsed.pagewise_line_items,
//         total_item_count: finalParsed.total_item_count,
//       },
//     });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ is_success: false, error: err.message });
//   }
// });

// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
