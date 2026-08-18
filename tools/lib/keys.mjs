/**
 * Atlas frame key rules (contract in docs/04-asset-pipeline.md):
 *
 *   <swf>/<symbol>/<frame>  — swf and symbol lowercased, no spaces.
 *   Frames use their timeline label when one exists ("idle", "grey"),
 *   otherwise a zero-padded 3-digit frame index ("001").
 *
 * These keys are a stable public contract: scenes and systems reference
 * them, so they must never be renamed between regeneration runs.
 */
export function frameKey(swf, symbolName, label, frameIndex) {
  const swfPart = String(swf).toLowerCase();
  const symbolPart = String(symbolName).toLowerCase();
  const framePart = label
    ? String(label).toLowerCase()
    : String(frameIndex).padStart(3, '0');
  return `${swfPart}/${symbolPart}/${framePart}`;
}

/** Parse a key back into its parts (used by tests and loaders). */
export function splitKey(key) {
  const parts = key.split('/');
  return { swf: parts[0], symbol: parts[1], frame: parts[2] };
}
