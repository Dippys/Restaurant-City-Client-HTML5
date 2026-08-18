/**
 * Typed runtime models for the generated data JSONs
 * (public/assets/generated/data/*.json, produced by tools/build-data.mjs —
 * shapes documented in docs/11-data-formats.md).
 *
 * Attribute values keep the AS3 semantics: strings unless the original
 * coerced them ("true"/"false" -> boolean, "null" -> null); item `cash`/
 * `cost` default to 0 when absent.
 */
export interface ItemConfig {
  name?: string;
  id?: string;
  cost?: number | string;
  cash?: number | string;
  types?: string[];
  ingredients?: string;
  className?: string;
  hash?: string;
  children?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ItemGroup {
  name: string | null;
  types?: string[];
  items: ItemConfig[];
  [key: string]: unknown;
}

export interface ItemDatabaseJson {
  groups: ItemGroup[];
}

export interface LangEntry {
  id: string | null;
  body: string;
}

export interface LangJson {
  langCode: string;
  entries: LangEntry[];
}

export interface ChallengeServe {
  recipe: string | null;
  containIngredients: string | null;
  count: string | null;
}

export interface ChallengeReward {
  ingredients: string[];
  recipes: string[];
}

export interface Challenge {
  id: string | null;
  name: string | null;
  text: string | null;
  iconName: string | null;
  durationHours: string | null;
  serve: ChallengeServe[];
  rewards: ChallengeReward[];
}

export interface ChallengesJson {
  challenges: Challenge[];
}

export type DataJson = ItemDatabaseJson | LangJson | ChallengesJson | Record<string, unknown>;

/** The data ids registered in manifest.json (see tools/lib/data/data-config.mjs). */
export type DataId =
  | 'ingredients'
  | 'perks'
  | 'recipes'
  | 'quiz'
  | 'avatars'
  | 'front'
  | 'restaurants'
  | 'appointments'
  | 'challenges'
  | 'newsletter';

export type LangCode = 'en' | 'fr';
