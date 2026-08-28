// strip-shot — ASCII-render only a vertical strip (fraction y0..y1) of a
// capture at high horizontal resolution, to spot UI buttons.
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

const y0 = parseFloat(process.argv[3] || '0.82');
const y1 = parseFloat(process.argv[4] || '1.0');
const COLS = 150;
const file = process.argv[2];
const { w, h, px } = decodePng(file);
const ROWS = 14;
console.log('===== ' + file.split(/[\\/]/).slice(-1)[0] + ' strip y ' + y0 + '..' + y1 + ' =====');
for (let cy = 0; cy < ROWS; cy++) {
  let line = '';
  for (let cx = 0; cx < COLS; cx++) {
    let r = 0, g = 0, b = 0, n = 0;
    const x0 = Math.floor((cx * w) / COLS), x1 = Math.floor(((cx + 1) * w) / COLS);
    const yy0 = Math.floor((y0 + (cy * (y1 - y0)) / ROWS) * h), yy1 = Math.floor((y0 + ((cy + 1) * (y1 - y0)) / ROWS) * h);
    for (let y = yy0; y < yy1; y += 2) for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
    }
    r /= n; g /= n; b /= n;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 30) line += '.';
    else if (r > 200 && g > 200 && b > 200) line += 'w';
    else if (b > r * 1.15 && b > 90 && g < b * 0.9) line += lum > 120 ? 'S' : 'B';
    else if (g > r * 1.25 && g > b * 1.1) line += lum > 140 ? 'g' : 'G';
    else if (r > g * 1.25 && r > b * 1.1) line += lum > 140 ? 'r' : 'R';
    else if (r > 140 && g > 100 && b < 90) line += 'o';
    else if (lum > 150) line += 'l';
    else line += 'd';
  }
  console.log(line);
}
