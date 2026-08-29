// swf-symbol-dump — parse a SWF, find a named symbol (Sprite), and dump its
// frame-1 child instances (PlaceObject2/3) with names and x/y translate
// (twips -> px, Flash origin: y grows downward from the sprite's origin).
const fs = require('fs');
const zlib = require('zlib');

const file = process.argv[2];
const wanted = process.argv[3]; // e.g. RoomUiButton
const b = fs.readFileSync(file);
const sig = b.toString('latin1', 0, 3);
const body = sig === 'CWS' ? zlib.inflateSync(b.subarray(8)) : b.subarray(8);

function readUI16(p) { return p.readUInt16LE(0); }
function readSI16(p) { return p.readInt16LE(0); }
function readSI32(p) { return p.readInt32LE(0); }

const tags = [];
let off = 0;
// Skip the RECT (frame size) that precedes the first tag in the tag stream.
{
  let bitPos = 0;
  const readBits = (n) => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byteIdx = Math.floor(bitPos / 8);
      const bitIdx = bitPos % 8;
      v = (v << 1) | ((body[byteIdx] >> (7 - bitIdx)) & 1);
      bitPos++;
    }
    return v;
  };
  const nb = readBits(5);
  for (let i = 0; i < 4; i++) readBits(nb);
  off = Math.ceil(bitPos / 8);
}
while (off < body.length) {
  const h = readUI16(body.subarray(off));
  const code = h >> 6;
  let len = h & 0x3f;
  off += 2;
  if (len === 0x3f) { len = readSI32(body.subarray(off)); off += 4; }
  tags.push({ code, data: body.subarray(off, off + len) });
  off += len;
}

// SymbolClass: map characterId -> name
const idToName = {};
for (const t of tags) {
  if (t.code !== 76) continue; // SymbolClass
  const d = t.data;
  let p = 0;
  const n = d.readUInt16LE(p); p += 2;
  for (let i = 0; i < n; i++) {
    const cid = d.readUInt16LE(p); p += 2;
    let end = p;
    while (d[end] !== 0) end++;
    const name = d.toString('latin1', p, end); p = end + 1;
    idToName[cid] = name;
  }
}
console.log('symbols:', Object.entries(idToName).length);

// Find the DefineSprite tag for the wanted symbol (it may be nested inside
// another sprite's data — handle top-level first, then nested).
function findSpriteTags(code, id) {
  const out = [];
  for (const t of tags) if (t.code === 39) { // DefineSprite
    const d = t.data;
    if (readUI16(d) === id) out.push(d);
  }
  return out;
}

let targetId = null;
for (const [id, name] of Object.entries(idToName)) if (name === wanted) targetId = Number(id);
if (targetId == null) { console.log('symbol not found:', wanted); process.exit(1); }
console.log('found id', targetId, 'for', wanted);

// Walk sprite tags (DefineSprite content): frames; children in frame 1.
function walkSprite(spriteData, indent) {
  let p = 0;
  const spriteId = readUI16(spriteData.subarray(p)); p += 2;
  const frameCount = readUI16(spriteData.subarray(p)); p += 2;
  // Skip the bounds RECT (twips).
  {
    let bitPos = p * 8;
    const readBits = (n) => {
      let v = 0;
      for (let i = 0; i < n; i++) {
        const byteIdx = Math.floor(bitPos / 8);
        const bitIdx = bitPos % 8;
        v = (v << 1) | ((spriteData[byteIdx] >> (7 - bitIdx)) & 1);
        bitPos++;
      }
      return v;
    };
    const nb = readBits(5);
    for (let i = 0; i < 4; i++) readBits(nb);
    p = Math.ceil(bitPos / 8);
  }
  console.log(`${' '.repeat(indent)}sprite ${spriteId} frames=${frameCount}`);
  let currentFrame = 0;
  while (p < spriteData.length) {
    const h = readUI16(spriteData.subarray(p));
    const code = h >> 6;
    let len = h & 0x3f;
    p += 2;
    if (len === 0x3f) { len = readSI32(spriteData.subarray(p)); p += 4; }
    const d = spriteData.subarray(p, p + len);
    if (code === 0) { // ShowFrame
      currentFrame++;
      p += len;
      if (currentFrame >= 1 && indent === 2) break; // only frame 1 children for the target
      continue;
    }
    if (code === 26 || code === 70) { // PlaceObject2 / PlaceObject3
      let q = 0;
      const flags = readUI16(d); q += 2;
      if (flags & 1) q += 2; // move
      const charId = flags & 2 ? readUI16(d.subarray(q)) : null; if (flags & 2) q += 2;
      const depth = readUI16(d.subarray(q)); q += 2;
      let name = null;
      if (flags & 4) { let e = q; while (d[e] !== 0) e++; name = d.toString('latin1', q, e); q = e + 1; }
      let x = null, y = null;
      if (flags & 16) { // has matrix
        const sx = 1, sy = 1, rot = 0; // skip scale/rotate for simplicity via full parse
        // parse MATRIX fully
        const m0 = d[q];
        const hasScale = (m0 >> 6) & 1;
        const hasRot = (m0 >> 5) & 1;
        let nBits = m0 & 0x1f;
        q += 1;
        const readBits = (n) => {
          let v = 0;
          for (let i = 0; i < n; i++) {
            let bit;
            const byteIdx = Math.floor(q / 8);
            const bitIdx = q % 8;
            bit = (d[byteIdx] >> (7 - bitIdx)) & 1;
            q++;
            v = (v << 1) | bit;
          }
          return v;
        };
        const signed = (n) => { const r = readBits(n); return r & (1 << (n - 1)) ? r - (1 << n) : r; };
        if (hasScale) { const sb = readBits(5); readBits(sb); readBits(sb); }
        if (hasRot) { const rb = readBits(5); readBits(rb); readBits(rb); }
        const tb = readBits(5);
        const tx = signed(tb);
        const ty = signed(tb);
        x = tx / 20; y = ty / 20;
      }
      const label = idToName[charId] || ('#' + charId);
      console.log(`${' '.repeat(indent + 2)}depth=${depth} char=${label}${name ? ' name="' + name + '"' : ''}${x != null ? ' x=' + x.toFixed(1) + ' y=' + y.toFixed(1) : ''}`);
      if (charId && idToName[charId]) {
        const subs = findSpriteTags(39, charId);
        for (const sd of subs) walkSprite(sd, indent + 4);
      }
    }
    p += len;
  }
}

for (const sd of findSpriteTags(39, targetId)) walkSprite(sd, 0);
