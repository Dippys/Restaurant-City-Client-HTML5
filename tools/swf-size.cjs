// Quick SWF RECT header check.
const fs = require('fs');
const zlib = require('zlib');
const b = fs.readFileSync(process.argv[2]);
const sig = b.toString('latin1', 0, 3);
const p = sig === 'CWS' ? zlib.inflateSync(b.subarray(8)) : b.subarray(8);
let bp = 0;
const rb = (n) => { let v = 0; for (let i = 0; i < n; i++) { v = (v << 1) | ((p[Math.floor(bp / 8)] >> (7 - (bp % 8))) & 1); bp++; } return v; };
const sgn = (n) => { const r = rb(n); return r & (1 << (n - 1)) ? r - (1 << n) : r; };
const nb = rb(5);
const x0 = sgn(nb), x1 = sgn(nb), y0 = sgn(nb), y1 = sgn(nb);
console.log(process.argv[2].split(/[\\/]/).slice(-2).join('/'), '=>', sig, Math.round((x1 - x0) / 20) + 'x' + Math.round((y1 - y0) / 20));
