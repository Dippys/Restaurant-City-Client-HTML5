import { spawnSync } from 'node:child_process';

/**
 * Thin wrapper around the JPEXS FFDec CLI.
 *
 * FFDec sometimes exits non-zero while still producing valid output (e.g.
 * warnings on stderr), so this returns raw { stdout, stderr, status } and
 * lets callers validate the output markers ("OK", expected files).
 */
const FFDEC = process.env.FFDEC ?? 'C:\\Program Files (x86)\\FFDec\\ffdec-cli.exe';

export function ffdec(args, { cwd } = {}) {
  const r = spawnSync(FFDEC, args, {
    encoding: 'utf8',
    cwd,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) {
    throw new Error(`ffdec failed to run: ${r.error.message}`);
  }
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status ?? -1 };
}

export function ffdecPath() {
  return FFDEC;
}
