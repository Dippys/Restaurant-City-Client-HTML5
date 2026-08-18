# 11 — Data formats (`bin-xml`)

The original client loaded these files through `resconfig.xml` resource
names and parsed them in ActionScript (`GameWorld.init`,
`GameInitLoader.ASSET_NAMES`). The rebuild ports those readers once, at
**tool time** (ADR-0008: `tools/lib/data/`), and the runtime loads typed
JSON registered in `manifest.json`.

**Key fact (verified M1):** every `.bin` is a **zlib-compressed XML
document** — the AS3 does `ByteArray.uncompress()` then `new XML(data)`.
There is no custom binary format.

Sources are the read-only workspace files `../bin-xml/<name>[1].bin` (the
`[1]` is a browser download suffix).

| File | Parser (AS3 spec) | Converter (port) | Status |
|---|---|---|---|
| `ingredient[1].bin` | `ItemDatabase` (`ItemDatabase.as`) | `itemDatabaseJson` | **verified** — 1 group, 62 items |
| `perk[1].bin` | `ItemDatabase` | `itemDatabaseJson` | verified |
| `recipe[1].bin` | `ItemDatabase` | `itemDatabaseJson` | **verified** — groups Starter/Main/Dessert; items carry `ingredients="a, b"` attribute lists, `className`, `hash`, `id` |
| `quiz[1].bin` | `ItemDatabase` | `itemDatabaseJson` | verified |
| `avatar[1].bin` | `ItemDatabase` | `itemDatabaseJson` | verified |
| `front[1].bin` | `ItemDatabase` | `itemDatabaseJson` | verified |
| `restaurant[1].bin` | `ItemDatabase` | `itemDatabaseJson` | verified |
| `appointment[1].bin` | `ItemDatabase` | `itemDatabaseJson` | verified |
| `challenge[1].bin` | `ChallengeDatabase` (`challenge/ChallengeDatabase.as`) | `challengeJson` | **verified** — 20 challenges, `<serve recipe containIngredients count>`, `<reward><ingredients>/<recipe>` |
| `lang_en[1].bin` / `lang_fr[1].bin` | `TextGroup` (`TextGroup.as`) | `langJson` | **verified** — `<content lang>` blocks, `<text id>body</text>`; 608 en entries (2 duplicate ids, as the AS3 stores them) |
| `newsletter[1].xml` | `NewsletterHandler` (plain XML) | `genericXml` passthrough | verified format; runtime consumer is M5 |
| `model[1].bin` | `Collada.parse` (Away3D) | — | **excluded**: 3D model, 2D rebuild doesn't use it (ADR-0003) |
| `resconfig[1].xml` | `ResourceHandler` URL manifest | — | **excluded**: replaced by generated `manifest.json` |

## Generated JSON layout

- `data/<id>.json` for each `ItemDatabase` file: `{ groups: [{ name,
  types?, ...attrs, items: [{ ...attrs, types?, cash, cost, children }] }] }`
- Item attributes keep AS3 semantics: strings except `"true"`/`"false"`
  → boolean, `"null"` → null, `type` → `types` array (not also `type`);
  `cash`/`cost` default to `0`.
- `data/lang_<code>.json`: `{ langCode, entries: [{ id, body }] }`.
- `data/challenges.json`: `{ challenges: [{ id, name, text, iconName,
  durationHours, serve: [{recipe, containIngredients, count}],
  rewards: [{ingredients, recipes}] }] }`.

## Verification

`tools/build-data.mjs` regenerates everything from the original files;
`tests/lib/data-readers.test.mjs` asserts the E4X semantics on inline
fixtures and the real files (group/item counts, attribute coercions,
deterministic output). `verify-pipeline.mjs` checks every manifest data
entry exists on disk and is non-empty.
