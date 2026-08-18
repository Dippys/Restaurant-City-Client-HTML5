/**
 * Per-SWF metadata for the pipeline.
 *
 * Ground truth: ../decompiled/setup-all-swfs.ps1 (stage sizes, fps, embed
 * kind). Entries marked `audio` or `codeOnly` are handled by other stages
 * (M1); the atlas path consumes sprite-bearing SWFs only.
 */
export const SWFS = {
  ingredient_asset: {
    stage: { width: 550, height: 400, fps: 12 },
    source: 'ingredient_asset.swf',
    kind: 'embed-swf',
    description: 'ingredient icons',
  },
  perk_asset: {
    stage: { width: 550, height: 400, fps: 12 },
    source: 'perk_asset.swf',
    kind: 'embed-swf',
    description: 'perk/power-up icons',
  },
  avatar_asset: {
    stage: { width: 550, height: 400, fps: 12 },
    source: 'avatar_asset.swf',
    kind: 'import-script',
    description: 'avatar customization parts',
  },
  game_asset: {
    stage: { width: 640, height: 700, fps: 25 },
    source: 'game_asset.swf',
    kind: 'embed-swf',
    description: 'HUD, panels, buttons',
  },
  indoor_asset: {
    stage: { width: 550, height: 400, fps: 25 },
    source: 'indoor_asset.swf',
    kind: 'embed-swf',
    description: 'furniture, appliances, decor',
  },
  outdoor_asset: {
    stage: { width: 550, height: 400, fps: 25 },
    source: 'outdoor_asset.swf',
    kind: 'embed-swf',
    description: 'scenery, pavement, fences, trees',
  },
  preloader_asset: {
    stage: { width: 640, height: 700, fps: 25 },
    source: 'preloader_asset.swf',
    kind: 'embed-swf',
    description: 'loading screen graphics',
  },
  sound_asset: {
    stage: { width: 550, height: 400, fps: 12 },
    source: 'sound_asset.swf',
    kind: 'embed-mp3',
    description: 'SFX and music (audio path, M1)',
  },
  preloader: {
    stage: { width: 760, height: 600, fps: 25 },
    source: 'preloader.swf',
    kind: 'pure-code',
    description: 'preloader logic only, no assets',
  },
  game: {
    stage: { width: 760, height: 600, fps: 25 },
    source: 'game.swf',
    kind: 'pure-code',
    description: 'game logic only, no assets (spec)',
  },
};

export const ATLAS_SWFS = Object.entries(SWFS)
  .filter(([, cfg]) => cfg.kind === 'embed-swf' || cfg.kind === 'import-script')
  .map(([name]) => name);
