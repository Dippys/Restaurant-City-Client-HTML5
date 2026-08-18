# 11 — Data formats (`bin-xml`)

The original client downloaded these data files and parsed them in
ActionScript. The rebuild ports the readers into `src/net/data/` and the
asset pipeline pre-converts each file to typed JSON (ADR-0005). This page is
the inventory; **the reader mapping is completed and verified during M1** —
until a row says "verified", treat the reader guess as a pointer, not a
fact.

Files live in `../bin-xml/` as `<name>[1].bin` (the `[1]` is a browser
download suffix; the backend fuzzy-matches it away).

| File | Purpose | Likely AS3 reader(s) | Status |
|---|---|---|---|
| `ingredient[1].bin` | Ingredient catalog | `IngredientItem.as` / ingredient data classes | to verify |
| `recipe[1].bin` | Dish catalog + levels | `Recipe.as`, `WorldRecipeMenu.as` | to verify |
| `model[1].bin` | Item/3D model metadata | `ItemDatabase.as` / model data classes | to verify |
| `avatar[1].bin` | Avatar part catalog | `AvatarItem.as`, `WorldCustomiseAvatar.as` | to verify |
| `perk[1].bin` | Perk catalog | `PerkItem.as` | to verify |
| `quiz[1].bin` | Quiz questions | quiz data class in `cooking/` | to verify |
| `challenge[1].bin` | Challenges | `challenge/` | to verify |
| `restaurant[1].bin` | Restaurant/building data | building data class | to verify |
| `front[1].bin` | Street-front data | `WorldStreet`/`StreetBuilding` | to verify |
| `appointment[1].bin` | Appointment (employee?) data | `GameUserEmployee` area | to verify |
| `lang_en[1].bin` / `lang_fr[1].bin` | String tables | `TextHandler.as` | to verify |
| `newsletter[1].xml` | Newsletter config | `NewsletterHandler.as` | to verify |
| `resconfig[1].xml` | Resource/URL config | `ResourceHandler.as` | verified (asset URL manifest) |

## M1 procedure (per file)

1. Grep the decompiled sources for the filename and trace the reader class.
2. Port the reader to `src/net/data/<name>.ts` with unit tests against the
   actual file bytes (fixtures may be copied read-only into
   `tests/fixtures/`).
3. Generate `<name>.json`, add to the manifest, and mark this table row
   "verified: <reader class>".
4. Record structural notes (field layout, enums, string encoding) in
   `docs/specs/data/<name>.md`.

## Format hints

- The game's binary data files share the PlayFish binary style (big-endian
  primitive reads) — reuse the varint/string readers from `05`.
- `resconfig.xml` is plain XML with relative `src=""` entries — it is the
  asset URL manifest the original used to fetch the asset SWFs; the rebuild
  replaces it with `manifest.json` but keeps its mapping semantics for
  reference.
