// diffmap — ASCII map of changed pixels between two PNGs. '#' = changed cell,
// '.' = same. Shows whether the change is centralized (zoom) or scattered.
const fs = require('fs');
const zlib = require('zlib');

function dec(f) {
  const b = fs.readFileSync(f);
  let o = 8, w = 0, h = 0, ct = 0;
  const id = [];
  while (o < b.length) {
    const l = b.readUInt32BE(o);
    const t = b.toString('latin1', o + 4, o + 8);
    const d = b.subarray(o + 8, o + 8 + l);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    else if (t === 'IDAT') id.push(d);
    else if (t === 'IEND') break;
    o += 12 + l;
  }
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(id));
  const st = w * ch;
  const px = Buffer.alloc(w * h * 4);
  let pr = Buffer.alloc(st);
  for (let y = 0; y < h; y++) {
    const fl = raw[y * (st + 1)];
    const ln = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1));
    const cu = Buffer.from(ln);
    for (let i = 0; i < st; i++) {
      const a = i >= ch ? cu[i - ch] : 0, bb = pr[i], c = i >= ch ? pr[i - ch] : 0;
      if (fl === 1) cu[i] = (cu[i] + a) & 255;
      else if (fl === 2) cu[i] = (cu[i] + bb) & 255;
      else if (fl === 3) cu[i] = (cu[i] + ((a + bb) >> 1)) & 255;
      else if (fl === 4) cu[i] = (cu[i] + (a + bb - c)) & 255;
    }
    for (let x = 0; x < w; x++) { const s = x * ch, d2 = (y * w + x) * 4; px[d2] = cu[s]; px[d2 + 1] = ch > 1 ? cu[s + 1] : cu[s]; px[d2 + 2] = ch > 2 ? cu[s + 2] : cu[s]; }
    pr = cu;
  }
  return { w, h, px };
}

const A = dec(process.argv[2]), B = dec(process.argv[3]);
const COLS = 100, ROWS = 34;
console.log('diff map ' + A.w + 'x' + A.h + ' (threshold 18/255 per channel):');
for (let cy = 0; cy < ROWS; cy++) {
  let line = '', changed = 0, cells = 0;
  for (let cx = 0; cx < COLS; cx++) {
    let diff = 0;
    const x0 = Math.floor((cx * A.w) / COLS), x1 = Math.floor(((cx + 1) * A.w) / COLS);
    const y0 = Math.floor((cy * A.h) / ROWS), y1 = Math.floor(((cy + 1) * A.h) / ROWS);
    for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) {
      const i = (y * A.w + x) * 4, j = (y * B.w + x) * 4;
      if (Math.abs(A.px[i] - B.px[i]) + Math.abs(A.px[i + 1] - B.px[i + 1]) + Math.abs(A.px[i + 2] - B.px[i + 2]) > 54) diff++;
      cells++;
    }
    const pct = diff / cells;
    line += pct > 0.5 ? '#' : pct > 0.2 ? '+' : pct > 0.05 ? '-' : '.';
    if (pct > 0.2) changed++;
  }
  console.log(line);
}
