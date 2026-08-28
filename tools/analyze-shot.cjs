// analyze-shot — decode a Playwright PNG screenshot in pure Node and report
// rendered content extents. A column/row counts as "content" when it holds
// more than a few distinct colors; uniform letterbox bars are skipped.
const fs = require('fs');
const zlib = require('zlib');

function decodePng(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png: ' + file);
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off);
    const type = b.toString('latin1', off + 4, off + 8);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('unsupported bit depth ' + bitDepth);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : null;
  if (!channels) throw new Error('unsupported color type ' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const px = Buffer.alloc(w * h * 4);
  const paeth = (a, bb, c) => {
    const p = a + bb - c, pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? bb : c;
  };
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.from(line);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const bb = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      if (filter === 1) cur[i] = (cur[i] + a) & 255;
      else if (filter === 2) cur[i] = (cur[i] + bb) & 255;
      else if (filter === 3) cur[i] = (cur[i] + ((a + bb) >> 1)) & 255;
      else if (filter === 4) cur[i] = (cur[i] + paeth(a, bb, c)) & 255;
    }
    for (let x = 0; x < w; x++) {
      const s = x * channels, d = (y * w + x) * 4;
      px[d] = cur[s]; px[d + 1] = channels > 1 ? cur[s + 1] : cur[s];
      px[d + 2] = channels > 2 ? cur[s + 2] : cur[s];
      px[d + 3] = channels > 3 ? cur[s + 3] : 255;
    }
    prev = cur;
  }
  return { w, h, px };
}

for (const file of process.argv.slice(2)) {
  const { w, h, px } = decodePng(file);
  const quant = (v) => (v >> 4) << 4; // 4-bit quantization buckets
  const colDistinct = (x) => {
    const s = new Set();
    for (let y = 0; y < h; y += 2) {
      const i = (y * w + x) * 4;
      s.add(quant(px[i]) * 65536 + quant(px[i + 1]) * 256 + quant(px[i + 2]));
      if (s.size > 24) return s.size;
    }
    return s.size;
  };
  const rowDistinct = (y) => {
    const s = new Set();
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      s.add(quant(px[i]) * 65536 + quant(px[i + 1]) * 256 + quant(px[i + 2]));
      if (s.size > 24) return s.size;
    }
    return s.size;
  };
  let minX = w, maxX = -1, minY = h, maxY = -1;
  const TH = 6; // distinct-color threshold for "content"
  for (let x = 0; x < w; x += 4) if (colDistinct(x) >= TH) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
  for (let y = 0; y < h; y += 4) if (rowDistinct(y) >= TH) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const l = colDistinct(2), r = colDistinct(w - 3), t = rowDistinct(2), btm = rowDistinct(h - 3);
  console.log(file.split(/[\\/]/).slice(-1)[0],
    `image=${w}x${h} content=${cw}x${ch}@(${minX},${minY})`,
    `margins L=${minX} R=${w - 1 - maxX} T=${minY} B=${h - 1 - maxY}`,
    `edgeDistinct L=${l} R=${r} T=${t} B=${btm}`,
    `contentAspect=${(cw / ch).toFixed(4)}`);
}
