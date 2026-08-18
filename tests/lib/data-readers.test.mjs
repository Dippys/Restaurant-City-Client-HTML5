import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  challengeJson,
  genericXml,
  itemDatabaseJson,
  langJson,
  parseBin,
  parseXmlText,
} from '../../tools/lib/data/xml-bins.mjs';

/** Helper: build a zlib-compressed XML bin like the game ships. */
const bin = (xml) => parseBin(zlib.deflateSync(Buffer.from(xml, 'utf8')));

describe('itemDatabaseJson (ItemDatabase.load port)', () => {
  it('applies the AS3 attribute semantics exactly', () => {
    const root = bin(`<data>
      <group name="Stoves" type="a, b" foo="bar" bar="null">
        <item name="Stove1" id="12" cost="100" type="x,y" />
        <item name="Stove2" flag="true" flag2="false" val="null" />
        <item name="Stove3" cash="5"><child a="1">text</child></item>
      </group>
    </data>`);
    const { groups } = itemDatabaseJson(root);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.name).toBe('Stoves');
    expect(g.types).toEqual(['a', 'b']);
    expect(g.foo).toBe('bar');
    expect(g.bar).toBeNull();
    // E4X code skips storing "type" as a plain attribute — only `types`.
    expect(g.type).toBeUndefined();

    const [s1, s2, s3] = g.items;
    expect(s1).toMatchObject({
      name: 'Stove1',
      id: '12',
      cost: '100',
      types: ['x', 'y'],
    });
    expect(s1.type).toBeUndefined();
    expect(s2.flag).toBe(true);
    expect(s2.flag2).toBe(false);
    expect(s2.val).toBeNull();
    expect(s2.cash).toBe(0); // defaults when absent
    expect(s2.cost).toBe(0);
    expect(s3.cash).toBe('5');
    // children = child ELEMENTS (attributes of the child are kept).
    expect(s3.children.child['@_a']).toBe('1');
    expect(s3.children.child['#text']).toBe('text');
  });

  it('handles groups without type and single-item groups', () => {
    const root = bin(`<data><group name="Solo"><item name="Only"/></group></data>`);
    const { groups } = itemDatabaseJson(root);
    expect(groups[0].types).toBeUndefined();
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].name).toBe('Only');
  });
});

describe('langJson (TextGroup port)', () => {
  it('picks the requested language content', () => {
    const root = bin(`<langs>
      <content lang="en"><text id="A">hello</text><text id="B">%C%</text></content>
      <content lang="fr"><text id="A">bonjour</text></content>
    </langs>`);
    expect(langJson(root, 'fr').entries).toEqual([{ id: 'A', body: 'bonjour' }]);
    expect(langJson(root, 'en').entries).toEqual([
      { id: 'A', body: 'hello' },
      { id: 'B', body: '%C%' },
    ]);
  });

  it('falls back to the first content block for unknown langs (AS3 behavior)', () => {
    const root = bin(`<langs><content lang="en"><text id="A">hello</text></content></langs>`);
    expect(langJson(root, 'zz').entries).toEqual([{ id: 'A', body: 'hello' }]);
  });

  it('handles declaration, CDATA and whitespace (lang_fr file shape)', () => {
    const root = parseBin(
      zlib.deflateSync(
        Buffer.from(
          `<?xml version="1.0"?>\n<contents>\n  <content lang="fr">\n    <text id="A"><![CDATA[Hello <B>%X%</B>]]></text>\n  </content>\n</contents>`,
          'utf8',
        ),
      ),
    );
    expect(langJson(root, 'fr').entries).toEqual([
      { id: 'A', body: 'Hello <B>%X%</B>' },
    ]);
  });
});

describe('challengeJson (ChallengeDatabase port)', () => {
  it('serializes challenges with serve/reward data', () => {
    const root = bin(`<data>
      <challenge id="1" name="C1" text="t" iconName="icon" durationHours="24">
        <serve recipe="Apple Pie" containIngredients="Apple, Flour" count="3"/>
        <reward><ingredients>Tomato, Cheese</ingredients><recipe>Pizza</recipe></reward>
      </challenge>
    </data>`);
    const { challenges } = challengeJson(root);
    expect(challenges).toHaveLength(1);
    expect(challenges[0].id).toBe('1');
    expect(challenges[0].serve[0]).toEqual({
      recipe: 'Apple Pie',
      containIngredients: 'Apple, Flour',
      count: '3',
    });
    expect(challenges[0].rewards[0]).toEqual({
      ingredients: ['Tomato', 'Cheese'],
      recipes: ['Pizza'],
    });
  });
});

describe('genericXml (newsletter passthrough)', () => {
  it('round-trips plain XML faithfully', () => {
    const root = parseXmlText('<news><item id="1" title="a">body</item></news>');
    expect(genericXml(root).item['@_id']).toBe('1');
    expect(genericXml(root).item['#text']).toBe('body');
  });
});

// Machine-local checks against the real workspace files (skip when absent).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BIN_XML = path.resolve(HERE, '..', '..', '..', 'bin-xml');
const hasBins = fs.existsSync(path.join(BIN_XML, 'ingredient[1].bin'));

describe.skipIf(!hasBins)('real bin-xml files (machine-local)', () => {
  const readBin = (name) => fs.readFileSync(path.join(BIN_XML, name));

  it('ingredient bin parses with groups and items', () => {
    const { groups } = itemDatabaseJson(parseBin(readBin('ingredient[1].bin')));
    expect(groups.length).toBeGreaterThan(0);
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBeGreaterThan(50);
    console.log(`  ingredients: ${groups.length} groups, ${total} items (${groups.map((g) => g.name).slice(0, 8).join(', ')}...)`);
  });

  it('recipe bin items carry their data in attributes (ingredients list)', () => {
    const { groups } = itemDatabaseJson(parseBin(readBin('recipe[1].bin')));
    const items = groups.flatMap((g) => g.items);
    expect(items.length).toBeGreaterThan(20);
    const withIngredients = items.filter(
      (i) => typeof i.ingredients === 'string' && i.ingredients.length > 0,
    );
    expect(withIngredients.length).toBeGreaterThan(items.length * 0.5);
    expect(groups.map((g) => g.name)).toEqual(
      expect.arrayContaining(['Starter', 'Main', 'Dessert']),
    );
    console.log(`  recipes: ${items.length} items, ${withIngredients.length} with ingredients attr`);
  });

  it('lang_en parses with (mostly) unique ids and non-empty bodies', () => {
    const lang = langJson(parseBin(readBin('lang_en[1].bin')), 'en');
    expect(lang.entries.length).toBeGreaterThan(500);
    const ids = lang.entries.map((e) => e.id);
    // The AS3 stores every <text id> verbatim (duplicates allowed; first
    // occurrence wins on lookup) — allow the small number the file has.
    const dupes = ids.length - new Set(ids).size;
    expect(dupes).toBeLessThanOrEqual(5);
    const nonEmpty = lang.entries.filter((e) => e.body.length > 0).length;
    expect(nonEmpty).toBeGreaterThan(lang.entries.length * 0.9);
    console.log(`  lang_en: ${lang.entries.length} entries (${dupes} duplicate ids); sample ids: ${ids.slice(0, 5).join(', ')}`);
  });

  it('remaining itemDatabase bins parse deterministically', () => {
    for (const name of ['perk', 'avatar', 'front', 'restaurant', 'appointment', 'quiz']) {
      const raw = readBin(`${name}[1].bin`);
      const a = JSON.stringify(itemDatabaseJson(parseBin(raw)));
      const b = JSON.stringify(itemDatabaseJson(parseBin(raw)));
      expect(a).toBe(b);
      expect(JSON.parse(a).groups.length).toBeGreaterThan(0);
    }
  });

  it('challenge bin parses with challenges', () => {
    const { challenges } = challengeJson(parseBin(readBin('challenge[1].bin')));
    expect(challenges.length).toBeGreaterThan(0);
    console.log(`  challenges: ${challenges.length}`);
  });

  it('newsletter xml parses', () => {
    const root = parseXmlText(readBin('newsletter[1].xml').toString('utf8'));
    expect(genericXml(root)).toBeTruthy();
  });
});

if (!hasBins) {
  console.warn(
    '[data-readers] workspace bin-xml not found — machine-local real-file tests skipped',
  );
}
