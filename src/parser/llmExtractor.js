import { callLLM } from "../llm/llmClient.js";


function buildPrompt(ocrText) {
  return `
You are a JSON extractor for invoices/bills. Input below is the raw OCR text extracted from an invoice image. Your job: extract line items only (product/service rows) and output a strict JSON object ONLY (no explanation, no backticks).

REQUIREMENTS:
1) Output must be valid JSON and exactly follow this schema:
{
  "pagewise_line_items": [
    {
      "page_no": "1",
      "page_type": "Bill Detail",
      "bill_items": [
        {
          "item_name": "string",
          "item_amount": number,
          "item_rate": number,
          "item_quantity": number
        }
      ]
    }
  ],
  "total_item_count": number,
  "token_usage": { "total_tokens": 0, "input_tokens": 0, "output_tokens": 0 }   // optional
}

2) Only extract rows that look like transactional items (quantity, rate, amount). DO NOT include:
   - invoice number, invoice date/time, GSTIN, phone numbers, page numbers, or IDs as amounts.
   - anything that appears to be a date (formats like dd/mm/yyyy, dd-mm-yyyy, yyyy/mm/dd, '20/11/2025' etc.) must NOT be placed into item_amount, item_rate, or item_quantity.

3) Numeric parsing:
   - item_amount, item_rate, item_quantity must be numeric (no commas), rounded to 2 decimals.
   - If quantity or rate is not present or ambiguous, set null for that field.
   - If a row clearly contains quantity and rate and amount (e.g. '2 419.06 838.12'), map appropriately.

4) Prioritize lines that have at least one currency-like number (e.g., 124.03) or numeric pattern. Try to correctly map quantity, rate and total amount.

5) If unsure about a particular row, prefer leaving quantity/rate null rather than guessing wrongly.

6) Provide 'page_type' as "Bill Detail" and 'page_no' as "1" for a single page input.

7) Output **ONLY** JSON. No additional text.

EXAMPLES:
Input OCR:
"92 Livi 300mg Tab 20/11/2025 14 32.00 448.00 0.00"
-> Extracted item_name: "Livi 300mg Tab", item_quantity: 14.00, item_rate: 32.00, item_amount: 448.00

Input OCR:
"Consuaton Charge | DR PREETHI MARY JOSEPH 300.00"
-> Extract name: "Consultation Charge | DR PREETHI MARY JOSEPH", item_amount: 300.00, item_rate: 300.00, item_quantity: 1.00

Now parse the OCR text below and return JSON using schema.

------ OCR START ------
${ocrText}
------ OCR END ------
`;
}

function safeParseJson(text) {
 
  const idx = text.indexOf("{");
  if (idx === -1) throw new Error("No JSON object in LLM response");
  const substr = text.slice(idx);
  return JSON.parse(substr);
}

function normalizeNumber(n) {
  if (n === null || n === undefined) return null;
  // if string, remove commas and non-numeric trailing chars
  if (typeof n === "string") {
    const cleaned = n.replace(/[^0-9.\-]/g, "");
    if (cleaned === "") return null;
    const val = Number(cleaned);
    if (Number.isNaN(val)) return null;
    return Math.round(val * 100) / 100;
  }
  if (typeof n === "number") return Math.round(n * 100) / 100;
  return null;
}

export async function extractJsonFromOcr(ocrText) {
  const prompt = buildPrompt(ocrText);

 
  const raw = await callLLM(prompt, { max_new_tokens: 1024, temperature: 0.0 });


  const parsed = safeParseJson(raw);


  if (!parsed.pagewise_line_items || !Array.isArray(parsed.pagewise_line_items)) {
    throw new Error("LLM returned unexpected schema: missing pagewise_line_items");
  }

  let totalCount = 0;
  parsed.pagewise_line_items = parsed.pagewise_line_items.map((page) => {
    const bill_items = (page.bill_items || []).map((it) => {
      const item = {
        item_name: it.item_name || "",
        item_amount: normalizeNumber(it.item_amount),
        item_rate: normalizeNumber(it.item_rate),
        item_quantity: normalizeNumber(it.item_quantity),
      };
      if (item.item_name) totalCount++;
      return item;
    });
    return {
      page_no: page.page_no || "1",
      page_type: page.page_type || "Bill Detail",
      bill_items,
    };
  });

  parsed.total_item_count = parsed.total_item_count || totalCount;

  
  parsed.token_usage = parsed.token_usage || { total_tokens: 0, input_tokens: 0, output_tokens: 0 };

  return parsed;
}
