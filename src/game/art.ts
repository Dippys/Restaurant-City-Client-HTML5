/**
 * Art resolution helpers: which atlas frame renders a given item config.
 *
 * Verified M2: interior item `className` matches indoor_asset symbols
 * (612/620) and building item `className` matches outdoor_asset symbols
 * (334/334). Frame key: <atlasKey>/<className lowercase>/<frame>.
 */
export interface ArtRef {
  readonly atlasKey: string;
  readonly className: string;
}

export const ART_ATLAS = {
  indoor: 'indoor_asset',
  outdoor: 'outdoor_asset',
  ingredient: 'ingredient_asset',
  perk: 'perk_asset',
  game: 'game_asset',
  avatar: 'avatar_asset',
} as const;

/** Frame keys of a symbol inside a loaded texture. */
export function symbolFrames(frameNames: readonly string[], atlasKey: string, className: string): string[] {
  const prefix = `${atlasKey}/${className.toLowerCase()}/`;
  return frameNames.filter((k) => k.startsWith(prefix)).sort();
}

/**
 * Picks the display frame for a symbol:
 * - rotation r uses frame r+1 when the symbol has that many frames (the
 *   AS3 advances the clip on rotate — RoomItem.rotate content.nextFrame);
 * - otherwise the labeled `idle` frame, then the first frame.
 */
export function pickDisplayFrame(
  frameNames: readonly string[],
  art: ArtRef,
  rotation = 0,
): string | null {
  const frames = symbolFrames(frameNames, art.atlasKey, art.className);
  if (frames.length === 0) {
    return null;
  }
  const rotated = rotation > 0 ? frames[rotation] : undefined;
  if (rotated) {
    return rotated;
  }
  return frames.find((f) => f.endsWith('/idle')) ?? frames[0] ?? null;
}
