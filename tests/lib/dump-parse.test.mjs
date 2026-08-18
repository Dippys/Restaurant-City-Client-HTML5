import { describe, expect, it } from 'vitest';
import { parseDump } from '../../tools/lib/dump-parse.mjs';

// Minimal dumpSWF-shaped fixture: two sprites, one with labeled frames and
// a nested sprite child, one with a single unlabeled frame.
const FIXTURE = [
  '00000042:    4. FrameLabel (name: "Apple") tagId= 43 len=       6  41 70 70 6c 65 00',
  '0000004a:    5. DefineShape2 (chid: 1)    tagId= 22 len=     367  01 00 54 7c ...',
  '000001bf:    6. DefineSprite (chid: 2)    tagId= 39 len=      17  02 00 01 00 87 06 ...',
  '000001c5:      0. PlaceObject2 (chid: 1, dpt: 7) tagId= 26 len=       7  06 07 00 01 00',
  '000001ce:      1. ShowFrame               tagId=  1 len=       0',
  '000001d2:    7. DefineSprite (chid: 3)    tagId= 39 len=      49  03 00 02 00 c5 0a ...',
  '000001d8:      0. FrameLabel (name: "idle") tagId= 43 len=       5  69 64 6c 65 00',
  '000001df:      1. PlaceObject2 (chid: 2, dpt: 1) tagId= 26 len=       7  06 01 00 ...',
  '000001e8:      2. ShowFrame               tagId=  1 len=       0',
  '000001ea:      3. FrameLabel (name: "grey") tagId= 43 len=       5  67 72 65 79 00',
  '000001f1:      4. PlaceObject2 (dpt: 1)   tagId= 26 len=      14  09 01 00 e8 40 ...',
  '00000201:      5. ShowFrame               tagId=  1 len=       0',
  '00000205:    8. DefineShape2 (chid: 4)    tagId= 22 len=     367  04 00 54 7c ...',
  '00000205:    9. DefineSprite (chid: 5)    tagId= 39 len=      17  05 00 01 00 87 06 ...',
  '00000205:      0. PlaceObject2 (chid: 4, dpt: 7) tagId= 26 len=       7  06 07 00 ...',
  '00000205:      1. ShowFrame               tagId=  1 len=       0',
  '00002c50:  254. ShowFrame                 tagId=  1 len=       0',
  '00002c52:  255. End                       tagId=  0 len=       0',
].join('\n');

describe('parseDump', () => {
  it('extracts sprite frame labels', () => {
    const sprites = parseDump(FIXTURE);
    expect([...sprites.keys()].sort()).toEqual([2, 3, 5]);
    expect(sprites.get(2).frames).toEqual([{ label: null }]);
    expect(sprites.get(3).frames).toEqual([
      { label: 'idle' },
      { label: 'grey' },
    ]);
    expect(sprites.get(5).frames).toEqual([{ label: null }]);
  });

  it('ignores main-timeline frames', () => {
    const sprites = parseDump(FIXTURE);
    expect(sprites.has(0)).toBe(false);
  });

  it('handles empty input', () => {
    expect(parseDump('')).toEqual(new Map());
  });

  it('handles CRLF line endings (FFDec emits them)', () => {
    const sprites = parseDump(FIXTURE.replace(/\n/g, '\r\n'));
    expect(sprites.get(3).frames).toEqual([
      { label: 'idle' },
      { label: 'grey' },
    ]);
  });
});
