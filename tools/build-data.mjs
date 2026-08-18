/**
 * Stage 3b: build-data
 *
 * Converts the bin-xml data files to typed JSON via the tool-time readers
 * (tools/lib/data/) and writes them under public/assets/generated/data/.
 * Build-manifest registers them in manifest.json.
 *
 *   node tools/build-data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  challengeJson,
  genericXml,
  itemDatabaseJson,
  langJson,
  parseBin,
  parseXmlText,
} from './lib/data/xml-bins.mjs';
import { DATA_FILES, EXCLUDED_SOURCES, LANGS } from './lib/data/data-config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(HERE, '..', '..');
const BIN_XML = path.join(WORKSPACE_ROOT, 'bin-xml');
const OUT_DIR = path.resolve(HERE, '..', 'public', 'assets', 'generated', 'data');

export function buildData() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const results = [];

  for (const entry of DATA_FILES) {
    const srcFile = path.join(BIN_XML, entry.source);
    if (entry.kind === 'excluded') {
      console.log(`data: ${entry.id} EXCLUDED (${entry.reason})`);
      results.push({ ...entry, excluded: true });
      continue;
    }
    if (!fs.existsSync(srcFile)) {
      throw new Error(`data source missing: ${srcFile}`);
    }
    const raw = fs.readFileSync(srcFile);
    let json;
    if (entry.kind === 'itemDatabase') {
      json = itemDatabaseJson(parseBin(raw));
    } else if (entry.kind === 'challenge') {
      json = challengeJson(parseBin(raw));
    } else if (entry.kind === 'newsletter') {
      json = genericXml(parseXmlText(raw.toString('utf8')));
    } else {
      throw new Error(`unknown data kind "${entry.kind}" for ${entry.id}`);
    }
    const outFile = path.join(OUT_DIR, `${entry.id}.json`);
    fs.writeFileSync(outFile, `${JSON.stringify(json, null, 2)}\n`);
    const size = fs.statSync(outFile).size;
    console.log(`data: ${entry.id} <- ${entry.source} (${size} bytes)`);
    results.push({ ...entry, file: `data/${entry.id}.json`, size });
  }

  for (const lang of LANGS) {
    const srcFile = path.join(BIN_XML, lang.source);
    if (!fs.existsSync(srcFile)) {
      throw new Error(`lang source missing: ${srcFile}`);
    }
    const json = langJson(parseBin(fs.readFileSync(srcFile)), lang.code);
    if (json.entries.length === 0) {
      throw new Error(`lang ${lang.code}: no entries parsed from ${lang.source}`);
    }
    const outFile = path.join(OUT_DIR, `lang_${lang.code}.json`);
    fs.writeFileSync(outFile, `${JSON.stringify(json, null, 2)}\n`);
    console.log(`data: lang_${lang.code} <- ${lang.source} (${json.entries.length} entries)`);
    results.push({
      id: `lang_${lang.code}`,
      file: `data/lang_${lang.code}.json`,
      entries: json.entries.length,
    });
  }

  for (const ex of EXCLUDED_SOURCES) {
    console.log(`data: ${ex.source} EXCLUDED (${ex.reason})`);
  }

  return results;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  buildData();
}
