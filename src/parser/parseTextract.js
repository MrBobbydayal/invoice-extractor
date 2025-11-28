export function parseTextractResponse(raw) {
  if (raw.Blocks) {
    const pages = {};

    for (const block of raw.Blocks) {
      if (block.BlockType === "LINE") {
        const page = block.Page || 1;
        if (!pages[page]) pages[page] = { page_no: page, lines: [] };

        const bb = block.Geometry?.BoundingBox;
        pages[page].lines.push({
          text: block.Text,
          confidence: block.Confidence,
          bbox: {
            left: bb?.Left ?? 0,
            top: bb?.Top ?? 0,
            width: bb?.Width ?? 1,
            height: bb?.Height ?? 0.02,
          },
        });
      }
    }

    return Object.values(pages);
  }

  
  return raw; 
}
