/**
 * Deterministic shelf packer for atlas building.
 *
 * Input frames are sorted by height desc, then key, so the same input
 * always produces the same layout (reproducibility contract). Each frame
 * gets `padding` pixels of transparent border in the atlas to avoid edge
 * bleeding when the GPU samples neighboring texels.
 */
export function packFrames(frames, { maxWidth = 2048, padding = 2 } = {}) {
  const sorted = [...frames].sort(
    (a, b) => b.h - a.h || String(a.key).localeCompare(String(b.key)),
  );

  let x = 0;
  let y = 0;
  let rowH = 0;
  let width = 0;
  const placements = [];

  for (const f of sorted) {
    const w = f.w + padding * 2;
    const h = f.h + padding * 2;
    if (x > 0 && x + w > maxWidth) {
      y += rowH;
      x = 0;
      rowH = 0;
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

  return { width, height: y + rowH, placements };
}
