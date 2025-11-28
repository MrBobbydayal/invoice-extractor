
# Invoice Extractor – OCR + LLM Powered Bill Parser

A production-ready backend service that extracts **structured bill line-items** from invoice images.
It combines **Tesseract OCR** for text extraction with a **Groq Llama 3 LLM** for accurate JSON parsing.

This project was built for the Bajaj Finserv HackRx challenge, where the goal is to convert unstructured invoice images into a uniform, machine-readable format that follows a very strict schema.

---

## Why this project exists

Traditional OCR systems can extract text, but cannot reliably understand items like quantity, rate, and amount.
This backend solves that gap by:

1. Extracting text from the invoice image.
2. Sending the extracted text to an LLM.
3. Enforcing a strict JSON schema exactly as required.
4. Returning clean, deduplicated, structured bill data.

This allows consistent downstream workflows such as analytics, fraud checks, or billing automation.

---

## Features

* Image download from a public link.
* OCR using Tesseract (no AWS required).
* LLM extraction using Groq’s high-speed, low-latency Llama-3 model.
* Strict schema enforcement identical to HackRx sample outputs.
* Cleans and normalizes all numeric fields.
* Protects against incorrect date/ID parsing.
* MongoDB logging of each extraction job.

---

## High-Level Architecture

```
Image URL → Download → OCR (Tesseract) → LLM Extraction → JSON Output
```

Each step is modular and easily replaceable.
LLM instructions follow a guarded prompt to avoid common errors such as interpreting dates or invoice numbers as amounts.

---

## Endpoints

### POST /extract-bill-data

Extract structured bill details from an invoice.

**Payload**

```json
{
  "document": "https://some-public-image-link.png"
}
```

**Success Response**

```json
{
  "is_success": true,
  "data": {
    "pagewise_line_items": [...],
    "total_item_count": 4
  }
}
```

If OCR or LLM fails, informative error messages are returned.

---

## Environment Configuration

Create a `.env` file in the project root.

```
PORT=3000

# MongoDB
MONGO_URI=your_connection_string
DB_NAME=invoice_db

# LLM Provider
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_key_here
LLM_MODEL=llama3-8b-8192
```

Your `.env` file should not be committed to Git.
Make sure `.gitignore` includes:

```
.env
```

---

## Running the Project

Install dependencies:

```
npm install
```

Start the server:

```
npm run dev
```

Use Postman or any API client to send a POST request to `localhost:3000/extract-bill-data`.

---

## Deployment Notes

The server is stateless and can be deployed easily to:

* Railway


---

## Project Structure

```
invoice_extractor/
├─ src/
│  ├─ config/
│  │  └─ db.js
│  ├─ ocr/
│  │  ├─ tesseract.js
│  │  └─ tesseractFallback.js
│  ├─ parser/
│  │  ├─ parseTextract.js
│  │  ├─ detectTotals.js
│  │  └─ llmExtractor.js
│  ├─ llm/
│  │  └─ llmClient.js
│  ├─ services/
│  │  └─ fileService.js
│  └─ utils/
│     ├─ utils.js
│     └─ dedupe.js
├─ server.js
├─ .env (ignored)
├─ README.md
```

---

## Notes on Accuracy

Cleaning the OCR output and guiding the LLM with strict constraints is essential.
The model is instructed to:

* Extract only transaction rows.
* Ignore invoice metadata.
* Avoid treating dates as numeric values.
* Always output valid JSON.
* Round numbers to two decimals.

This approach aligns with the hackathon guidelines recommending a two-step pipeline:
OCR first, then LLM-based structured extraction.

---

## Disclaimer

This project is built for educational and hackathon purposes.
Always safeguard API keys and sensitive configuration files.
Do not commit `.env` or secrets into public repositories.

---

## Author

Bobbydayal Saket
Full-Stack Developer

---
