export function extractNumber(str) {
  if (!str) return null;

  let cleaned = str.replace(/[^0-9.,-]/g, "");

  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/,/g, "");
  }

  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function bboxIoU(a, b) {
  const ax2 = a.left + a.width;
  const ay2 = a.top + a.height;
  const bx2 = b.left + b.width;
  const by2 = b.top + b.height;

  const interLeft = Math.max(a.left, b.left);
  const interTop = Math.max(a.top, b.top);
  const interRight = Math.min(ax2, bx2);
  const interBottom = Math.min(ay2, by2);

  const interArea =
    Math.max(0, interRight - interLeft) *
    Math.max(0, interBottom - interTop);

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;

  const union = areaA + areaB - interArea;

  return union <= 0 ? 0 : interArea / union;
}
