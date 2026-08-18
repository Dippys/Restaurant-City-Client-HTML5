/**
 * Data-file readers (tool-time) for the bin-xml files.
 *
 * All `.bin` files are zlib-compressed XML (the AS3 does
 * `ByteArray.uncompress()` then `new XML(data)` — spec:
 * decompiled/game/scripts/com/playfish/games/cooking/GameWorld.as L1845+).
 * These converters port the exact E4X semantics of the original parsers:
 *
 *   itemDatabaseJson  <- ItemDatabase.load
 *   langJson          <- TextGroup
 *   challengeJson     <- ChallengeDatabase.load (+ ChallengeTaskServeDish)
 *   genericXml        <- used for newsletter.xml and any passthrough docs
 *
 * Faithfulness rules (mirroring AS3 behavior):
 * - attribute values stay strings unless the AS3 coerced them ("true",
 *   "false" -> boolean, "null" -> null).
 * - "type" attributes become `types` arrays (split on whitespace-separated
 *   commas) and are NOT also stored under "type" (E4X code paths skip them).
 * - item `cash`/`cost` default to 0 when absent.
 */
import zlib from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false, // keep all values as strings (AS3 E4X strings)
  parseAttributeValue: false,
  trimValues: true, // E4X-style trimmed text; drops whitespace-only noise
  ignoreDeclaration: true, // the real files carry <?xml ...?> headers
});

/** fast-xml-parser wraps the document under its root element name and may
 *  surface the XML declaration ("?xml") plus whitespace ("#text") keys;
 *  the converters expect the root element itself (like E4X root access). */
function unwrapRoot(doc) {
  const keys = Object.keys(doc).filter((k) => !k.startsWith('?') && k !== '#text');
  return keys.length === 1 ? doc[keys[0]] : doc;
}

/** Inflate a zlib-compressed bin and parse it as XML. */
export function parseBin(buf) {
  const xmlText = zlib.inflateSync(buf).toString('utf8');
  return unwrapRoot(parser.parse(xmlText));
}

/** Parse a plain XML file (e.g. newsletter.xml). */
export function parseXmlText(text) {
  return unwrapRoot(parser.parse(text));
}

export function asList(x) {
  return x === undefined ? [] : Array.isArray(x) ? x : [x];
}

function attrsOf(node) {
  // fast-xml-parser flattens attributes onto the element as "@_name" keys.
  const out = {};
  if (!node || typeof node !== 'object') return out;
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('@_')) out[k.slice(2)] = v;
  }
  return out;
}

/** Serialize an ELEMENT faithfully: attributes ("@_name" keys), text
 *  ("#text"), and element children all kept. */
function serializeElement(node) {
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (Array.isArray(value)) {
      out[key] = value.map((v) => (typeof v === 'object' ? serializeElement(v) : v));
    } else if (typeof value === 'object') {
      out[key] = serializeElement(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Serialize ELEMENT children (E4X `children()` semantics): the parent's
 *  own attributes and text are excluded; child elements are serialized
 *  faithfully (keeping their attributes and text). */
function serializeChildren(node) {
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@_') || key === '#text') continue;
    if (Array.isArray(value)) {
      out[key] = value.map((v) => (typeof v === 'object' ? serializeElement(v) : v));
    } else if (typeof value === 'object') {
      out[key] = serializeElement(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Port of ItemDatabase.load (group/item E4X walk). */
export function itemDatabaseJson(root) {
  const groups = [];
  for (const g of asList(root.group)) {
    const gattrs = attrsOf(g);
    const groupObj = {};
    groupObj.name = gattrs.name ?? null;
    const gtype = gattrs.type;
    if (typeof gtype === 'string' && gtype.length > 0) {
      groupObj.types = gtype.split(/\s*,\s*/);
    }
    for (const [k, v] of Object.entries(gattrs)) {
      if (k === 'name' || k === 'type') continue;
      groupObj[k] = v === 'null' ? null : v;
    }
    const items = [];
    for (const it of asList(g.item)) {
      const iattrs = attrsOf(it);
      const itemObj = { cash: 0, cost: 0 };
      for (const [k, v] of Object.entries(iattrs)) {
        if (k === 'type') {
          itemObj.types = String(v).split(/\s*,\s*/);
        } else if (v === 'true') {
          itemObj[k] = true;
        } else if (v === 'false') {
          itemObj[k] = false;
        } else {
          itemObj[k] = v === 'null' ? null : v;
        }
      }
      itemObj.children = serializeChildren(it);
      items.push(itemObj);
    }
    groupObj.items = items;
    groups.push(groupObj);
  }
  return { groups };
}

/** Port of TextGroup: pick the <content lang=...> and list text id/body pairs. */
export function langJson(root, langCode) {
  const contents = asList(root.content);
  let content = contents[0];
  for (const c of contents) {
    if (attrsOf(c).lang === langCode) {
      content = c;
      break;
    }
  }
  const entries = [];
  for (const t of asList(content?.text)) {
    if (t === undefined || t === null) continue;
    const body =
      typeof t === 'string' ? t : t['#text'] !== undefined ? t['#text'] : '';
    entries.push({ id: attrsOf(t).id ?? null, body });
  }
  return { langCode, entries };
}

/** Port of ChallengeDatabase.load (+ChallengeTaskServeDish.parse). */
export function challengeJson(root) {
  const challenges = asList(root.challenge).map((c) => {
    const a = attrsOf(c);
    const out = {
      id: a.id ?? null,
      name: a.name ?? null,
      text: a.text ?? null,
      iconName: a.iconName ?? null,
      durationHours: a.durationHours ?? null,
    };
    out.serve = asList(c.serve).map((s) => {
      const sa = attrsOf(s);
      return {
        recipe: sa.recipe ?? null,
        containIngredients: sa.containIngredients ?? null,
        count: sa.count ?? null,
      };
    });
    out.rewards = asList(c.reward).map((r) => ({
      ingredients: asList(r.ingredients)
        .map((i) => (typeof i === 'string' ? i : i['#text'] ?? ''))
        .join(',')
        .split(/\s*,\s*/)
        .map((s) => s.trim())
        .filter(Boolean),
      recipes: asList(r.recipe)
        .map((i) => (typeof i === 'string' ? i : i['#text'] ?? ''))
        .filter(Boolean),
    }));
    return out;
  });
  return { challenges };
}

/** Generic faithful XML passthrough (newsletter.xml and similar): the
 *  parsed element tree as-is, with attributes under "@_name" keys. */
export function genericXml(root) {
  return root;
}
