/**
 * Runtime loader for the generated data JSONs (docs/11, ADR-0008).
 *
 * Manifest `data`/`langs` `file` fields are relative to
 * public/assets/generated/ — runtime URLs are /assets/generated/<file>.
 * Responses are content-type guarded because Vite's SPA fallback answers
 * unknown paths with 200 text/html (see docs/04 runtime URL rule).
 */
import type { ChallengesJson, DataJson, ItemDatabaseJson, LangCode, LangJson } from './types';

const GENERATED = 'assets/generated/';

const cache = new Map<string, DataJson>();

async function fetchJson<T extends DataJson>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`data fetch HTTP ${response.status} for ${url}`);
  }
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('json') && !type.includes('text')) {
    throw new Error(`unexpected content-type "${type}" for ${url}`);
  }
  return (await response.json()) as T;
}

/** Loads a data file by manifest id, cached for the session. */
export async function loadData<T extends DataJson>(id: string): Promise<T> {
  const url = `/${GENERATED}data/${id}.json`;
  const cached = cache.get(url);
  if (cached !== undefined) {
    return cached as T;
  }
  const json = await fetchJson<T>(url);
  cache.set(url, json);
  return json;
}

export function loadItemDatabase(id: string): Promise<ItemDatabaseJson> {
  return loadData<ItemDatabaseJson>(id);
}

export function loadChallenges(): Promise<ChallengesJson> {
  return loadData<ChallengesJson>('challenges');
}

export function loadLang(code: LangCode): Promise<LangJson> {
  return loadData<LangJson>(`lang_${code}`);
}
