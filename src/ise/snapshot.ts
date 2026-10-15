/**
 * ISE anti-leakage boundary. The inferrer may read only a project's source and its in-memory APG: never a spec, a
 * preset copy shipped with the project, an expected-*.json, a variant patch or its metadata, or a folder name that
 * names the variant. `snapshotSource` copies exactly `src/**` and `tsconfig.json` into a fresh directory with a
 * neutral name (`<tmp>/ise-snap-XXXX/project`); the inferrer is only ever given that directory.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** What a snapshot may contain, relative to its root. */
export const SNAPSHOT_ENTRIES = ['src', 'tsconfig.json'] as const;

export interface SourceSnapshot {
  /** The project directory handed to the inferrer. */
  readonly dir: string;
  /** Removes the snapshot. */
  readonly dispose: () => void;
}

/** Copies `src/` and `tsconfig.json` of `projectDir` (nothing else) to a new temporary directory. */
export function snapshotSource(projectDir: string, tmpRoot: string = os.tmpdir()): SourceSnapshot {
  const src = path.join(projectDir, 'src');
  const tsconfig = path.join(projectDir, 'tsconfig.json');
  if (!fs.existsSync(src)) throw new Error(`ISE snapshot: ${projectDir} has no src/`);
  if (!fs.existsSync(tsconfig)) throw new Error(`ISE snapshot: ${projectDir} has no tsconfig.json`);
  const holder = fs.mkdtempSync(path.join(tmpRoot, 'ise-snap-'));
  const dir = path.join(holder, 'project');
  fs.mkdirSync(dir);
  fs.cpSync(src, path.join(dir, 'src'), { recursive: true });
  fs.copyFileSync(tsconfig, path.join(dir, 'tsconfig.json'));
  return { dir, dispose: () => { fs.rmSync(holder, { recursive: true, force: true }); } };
}

/** Project-relative paths of every file in a snapshot (forward slashes, sorted). */
export function listSnapshotFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else out.push(path.relative(dir, abs).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}
