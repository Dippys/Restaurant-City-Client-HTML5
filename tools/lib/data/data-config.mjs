/**
 * Data-file inventory (contract: docs/11-data-formats.md).
 *
 * Source files live in the workspace `bin-xml/` directory and are READ-ONLY
 * pipeline inputs. `kind` selects the converter in xml-bins.mjs; `excluded`
 * records files deliberately not converted (with the ADR/doc reason).
 */
export const DATA_FILES = [
  { id: 'ingredients', source: 'ingredient[1].bin', kind: 'itemDatabase' },
  { id: 'perks', source: 'perk[1].bin', kind: 'itemDatabase' },
  { id: 'recipes', source: 'recipe[1].bin', kind: 'itemDatabase' },
  { id: 'quiz', source: 'quiz[1].bin', kind: 'itemDatabase' },
  { id: 'avatars', source: 'avatar[1].bin', kind: 'itemDatabase' },
  { id: 'front', source: 'front[1].bin', kind: 'itemDatabase' },
  { id: 'restaurants', source: 'restaurant[1].bin', kind: 'itemDatabase' },
  { id: 'appointments', source: 'appointment[1].bin', kind: 'itemDatabase' },
  { id: 'challenges', source: 'challenge[1].bin', kind: 'challenge' },
  { id: 'newsletter', source: 'newsletter[1].xml', kind: 'newsletter' },
  {
    id: 'model',
    source: 'model[1].bin',
    kind: 'excluded',
    reason: 'zlib-compressed Collada 3D XML — 2D rebuild does not use it (ADR-0003)',
  },
];

export const LANGS = [
  { code: 'en', source: 'lang_en[1].bin' },
  { code: 'fr', source: 'lang_fr[1].bin' },
];

/** resconfig.xml is replaced by manifest.json in the rebuild. */
export const EXCLUDED_SOURCES = [
  {
    source: 'resconfig[1].xml',
    reason: 'asset URL manifest — replaced by generated manifest.json (docs/04-asset-pipeline.md)',
  },
];
