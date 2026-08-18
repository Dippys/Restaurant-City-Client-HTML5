/**
 * Collect the Define* tag kind for every top-level character id
 * (DefineSprite, DefineBitsLossless2, DefineButton2, DefineShape2, ...).
 * Used to route linked symbols to the right FFDec export.
 */
export function parseDefineKinds(text) {
  /** @type {Map<number, string>} */
  const kinds = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/Define(\w+) \(chid: (\d+)\)/);
    if (m) {
      kinds.set(Number(m[2]), m[1]);
    }
  }
  return kinds;
}

/**
 * Parse `ffdec -dumpSWF` text output.
 *
 * dumpSWF prints a tag tree with indentation:
 *   top-level tags   -> 4 leading spaces
 *   sprite children  -> 6 leading spaces
 *   (deeper nesting  -> +2 spaces per level)
 *
 * We only need, per DefineSprite: its frames and the FrameLabel (if any)
 * attached to each frame. ShowFrame closes the current frame.
 */
export function parseDump(text) {
  /** @type {Map<number, {chid:number, frames:{label:string|null}[]}>} */
  const sprites = new Map();
  const stack = []; // { chid, level, frames, currentLabel }

  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^[0-9a-f]{8}:\s+\d+\.\s+(.*)$/);
    if (!m) continue;
    const rest = m[1];
    const afterPrefix = raw.slice(raw.indexOf(':') + 1);
    const level = (afterPrefix.length - afterPrefix.trimStart().length) / 2;

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const spriteMatch = rest.match(/^DefineSprite \(chid: (\d+)\)/);
    if (spriteMatch) {
      const ctx = {
        chid: Number(spriteMatch[1]),
        level,
        frames: [],
        currentLabel: null,
      };
      sprites.set(ctx.chid, ctx);
      stack.push(ctx);
      continue;
    }

    if (stack.length > 0) {
      const top = stack[stack.length - 1];
      const labelMatch = rest.match(/^FrameLabel \(name: "([^"]*)"\)/);
      if (labelMatch) {
        top.currentLabel = labelMatch[1];
        continue;
      }
      if (/^ShowFrame\b/.test(rest)) {
        top.frames.push({ label: top.currentLabel });
        top.currentLabel = null;
      }
    }
  }

  return sprites;
}
