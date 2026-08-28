// colprofile — for each 10px column band, count distinct colors in the middle
// band of the image; content bands vary a lot, letterbox bands are uniform.
// Prints a 156-char line per image: '#' = high variance (content), '.' = low.
const fs = require('fs');
const zlib = require('zlib');

function decodePng(file) {
  const b = fs.readFileSync(file);
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
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const px = Buffer.alloc(w * h * 4);
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
      else if (filter === 4) cur[i] = (cur[i] + (a + bb - c)) & 255;
    }
    for (let x = 0; x < w; x++) {
      const s = x * channels, d = (y * w + x) * 4;
      px[d] = cur[s]; px[d + 1] = channels > 1 ? cur[s + 1] : cur[s];
      px[d + 2] = channels > 2 ? cur[s + 2] : cur[s];
    }
    prev = cur;
  }
  return { w, h, px };
}

const BAND = 10;
for (const file of process.argv.slice(2)) {
  const { w, h, px } = decodePng(file);
  const quant = (v) => (v >> 4) << 4;
  const y0 = Math.floor(h * 0.12), y1 = Math.floor(h * 0.88);
  let line = '';
  let prevN = -1;
  for (let x0 = 0; x0 < w; x0 += BAND) {
    const s = new Set();
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < Math.min(x0 + BAND, w); x += 2) {
        const i = (y * w + x) * 4;
        s.add(quant(px[i]) * 65536 + quant(px[i + 1]) * 256 + quant(px[i + 2]));
        if (s.size > 30) break;
      }
      if (s.size > 30) break;
    }
    const n = s.size;
    line += n >= 10 ? '#' : n >= 5 ? '+' : n >= 3 ? '-' : '.';
  }
  console.log(file.split(/[\\/]/).slice(-1)[0], w + 'x' + h);
  console.log(line);
}
