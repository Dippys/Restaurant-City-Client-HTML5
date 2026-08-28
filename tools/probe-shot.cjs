// probe-shot — print sampled pixel colors along the center row/column and
// strip averages, to understand letterboxing in a capture.
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
      else if (filter === 4) cur[i] = (cur[i] + Math.min(a, bb) + Math.max(a, bb) - c) & 255; // paeth approx for probe
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

for (const file of process.argv.slice(2)) {
  const { w, h, px } = decodePng(file);
  const hex = (i) => `#${[0, 1, 2].map((c) => px[i + c].toString(16).padStart(2, '0')).join('')}`;
  const cy = Math.floor(h / 2);
  console.log('\n' + file.split(/[\\/]/).slice(-1)[0], `${w}x${h}`);
  const rows = [Math.floor(h * 0.02), Math.floor(h * 0.1), Math.floor(h * 0.25), cy, Math.floor(h * 0.7), h - 5];
  for (const ry of rows) {
    console.log('row y=' + ry + ':');
    const xs = [];
    for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 20))) xs.push(x);
    xs.push(w - 1);
    console.log(xs.map((x) => `x${x}:${hex((ry * w + x) * 4)}`).join('  '));
  }
  // strip averages
  const strips = [[0, 60], [Math.floor(w / 2) - 30, Math.floor(w / 2) + 30], [w - 60, w]];
  console.log('strip avg RGB (L / center / R):');
  console.log(strips.map(([a, b]) => {
    let r = 0, g = 0, bl = 0, n = 0;
    for (let x = a; x < b; x += 2) for (let y = 0; y < h; y += 2) {
      const i = (y * w + x) * 4; r += px[i]; g += px[i + 1]; bl += px[i + 2]; n++;
    }
    return `[${Math.round(r / n)},${Math.round(g / n)},${Math.round(bl / n)}]`;
  }).join(' '));
}
