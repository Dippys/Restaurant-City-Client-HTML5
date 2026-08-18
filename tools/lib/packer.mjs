/**
 * Deterministic shelf packer for atlas building, with paging.
 *
 * Input frames are sorted by height desc, then key, so the same input
 * always produces the same layout (reproducibility contract). Frames get
 * `padding` transparent border pixels to avoid GPU edge bleeding. When a
 * page would exceed maxWidth x maxHeight, packing continues on a new page.
 * A single frame larger than a page gets its own oversized page.
 *
 * Returns { pages: [{ width, height, placements }] } — one texture image
 * per page (Phaser multi-atlas supports any number of textures).
 */
export function packFrames(frames, { maxWidth = 2048, maxHeight = 2048, padding = 2 } = {}) {
  const sorted = [...frames].sort(
    (a, b) => b.h - a.h || String(a.key).localeCompare(String(b.key)),
  );

  const pages = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  let width = 0;
  let placements = [];

  const closePage = (height = y + rowH) => {
    pages.push({ width: Math.max(width, 1), height: Math.max(height, 1), placements });
    placements = [];
    x = 0;
    y = 0;
    rowH = 0;
    width = 0;
  };

  for (const f of sorted) {
    const w = f.w + padding * 2;
    const h = f.h + padding * 2;
    if (w > maxWidth || h > maxHeight) {
      // Oversized frame: its own page, grown to fit.
      if (placements.length > 0) closePage();
      width = Math.max(width, w);
      placements.push({ key: f.key, x: padding, y: padding, w: f.w, h: f.h });
      closePage(Math.max(h, 1));
      continue;
    }
    if (x > 0 && x + w > maxWidth) {
      y += rowH;
      x = 0;
      rowH = 0;
    }
    if (y > 0 && y + h > maxHeight) {
      closePage(y);
    }
    placements.push({
      key: f.key,
      x: x + padding,
      y: y + padding,
      w: f.w,
      h: f.h,
    });
    x += w;
    rowH = Math.max(rowH, h);
    width = Math.max(width, x);
  }

  if (placements.length > 0) {
    closePage();
  }
  return { pages };
}
