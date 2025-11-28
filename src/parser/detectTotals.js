import levenshtein from "fast-levenshtein";
import { extractNumber, bboxIoU } from "../utils/utils.js";

export function detectTotalsAndDedupe(parsedPages) {
  let allItems = [];
  let extracted_total = null;
  const pagewise_line_items = [];

  for (const page of parsedPages) {
    const pageItems = [];

    for (const line of page.lines) {
      const text = line.text.trim();
      if (!text) continue;

      const lower = text.toLowerCase();
      if (lower.includes("total")) {
        const num = extractNumber(text);
        if (num !== null) extracted_total = num;
        continue;
      }

      const matches = [...text.matchAll(/\d[\d.,]*/g)];
      if (!matches.length) continue;

      const amount = extractNumber(matches[matches.length - 1][0]);
      const rate =
        matches.length >= 2 ? extractNumber(matches[matches.length - 2][0]) : null;
      const qty =
        matches.length >= 3 ? extractNumber(matches[matches.length - 3][0]) : null;

      const name = text.slice(0, matches[0].index).trim();

      if (amount !== null) {
        const item = {
          item_name: name || text,
          item_quantity: qty,
          item_rate: rate,
          item_amount: amount,
          bbox: line.bbox,
        };

        pageItems.push(item);
        allItems.push(item);
      }
    }

    pagewise_line_items.push({
      page_no: String(page.page_no),
      page_type: "Bill Detail",
      bill_items: pageItems,
    });
  }

  // DEDUPLICATION
  const unique = [];
  for (const item of allItems) {
    let duplicate = false;

    for (const u of unique) {
      const sim =
        1 -
        levenshtein.get(
          item.item_name.toLowerCase(),
          u.item_name.toLowerCase()
        ) /
          Math.max(item.item_name.length, u.item_name.length);

      const amountClose = Math.abs(item.item_amount - u.item_amount) < 0.01;

      if (bboxIoU(item.bbox, u.bbox) > 0.5 || (sim > 0.85 && amountClose)) {
        duplicate = true;
        break;
      }
    }

    if (!duplicate) unique.push(item);
  }

  const calculated_total = unique.reduce((s, x) => s + x.item_amount, 0);

  return {
    pagewise_line_items,
    total_item_count: unique.length,
    calculated_total: Number(calculated_total.toFixed(2)),
    extracted_total,
  };
}
