import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { sha256Hex } from './canonical-json.js';
import type { CassetteEntry, RunManifest } from './types.js';

/**
 * Cassette file store (U4 DE §4.1, §4.7; BR-U4-CAS-01..09, AGG-03). Used only by the
 * cassette decorator (`cassette-provider.ts`); the v1 API keyed by `functionId_runIndex`
 * (saveCassette / loadCassette / cassetteExists) is gone.
 *
 * Layout: `<dir>/<key[0..1]>/<key>.json`; run manifests of incomplete runs in
 * `<dir>/_incomplete/<sha256(projectRoot ‖ "\0" ‖ specSha)[0..16]>.json`.
 */

export const INCOMPLETE_DIR = '_incomplete';

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) out[key] = sortKeys(record[key]);
    return out;
  }
  return value;
}

/** Pretty-printed JSON with keys sorted recursively and a trailing newline. */
export function sortedJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

/** Writes `content` to `filePath` atomically (temp file in the same directory, then rename). */
export function writeFileAtomic(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${String(process.pid)}.${randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}

export function cassetteFilePath(dir: string, key: string): string {
  return path.join(dir, key.slice(0, 2), `${key}.json`);
}

/** Reads the entry of `key`, or `null` when there is none. */
export function readCassetteEntry(dir: string, key: string): CassetteEntry | null {
  const file = cassetteFilePath(dir, key);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as CassetteEntry;
}

export function writeCassetteEntry(dir: string, entry: CassetteEntry): string {
  const file = cassetteFilePath(dir, entry.key);
  writeFileAtomic(file, sortedJson(entry));
  return file;
}

/** Every stored key, sorted (manifests and temp files excluded). */
export function listCassetteKeys(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const keys: string[] = [];
  for (const shard of fs.readdirSync(dir).sort()) {
    if (shard === INCOMPLETE_DIR) continue;
    const shardDir = path.join(dir, shard);
    if (!fs.statSync(shardDir).isDirectory()) continue;
    for (const name of fs.readdirSync(shardDir)) {
      if (name.endsWith('.json')) keys.push(name.slice(0, -'.json'.length));
    }
  }
  return keys.sort();
}

export function runManifestPath(dir: string, projectRoot: string, specSha: string): string {
  return path.join(dir, INCOMPLETE_DIR, `${sha256Hex(`${projectRoot}\u0000${specSha}`).slice(0, 16)}.json`);
}

/** AGG-03: written only for an incomplete run (the manifest's strings are scrubbed by the caller). */
export function writeRunManifest(dir: string, projectRoot: string, specSha: string, manifest: RunManifest): string {
  const file = runManifestPath(dir, projectRoot, specSha);
  writeFileAtomic(file, sortedJson(manifest));
  return file;
}

export function readRunManifest(dir: string, projectRoot: string, specSha: string): RunManifest | null {
  const file = runManifestPath(dir, projectRoot, specSha);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as RunManifest;
}

/** Deletes the manifest when the same run later completes; removes `_incomplete/` when it is empty. */
export function clearRunManifest(dir: string, projectRoot: string, specSha: string): boolean {
  const file = runManifestPath(dir, projectRoot, specSha);
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file);
  const incomplete = path.dirname(file);
  if (fs.readdirSync(incomplete).length === 0) fs.rmdirSync(incomplete);
  return true;
}
