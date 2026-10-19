/**
 * S12 archive step of a loop out-root (readiness gate S12, "Raw outputs archived, hashed, path-free";
 * `Docs/v1.3/study2-readiness-gate.md`). No model call, no Neo4j.
 *
 * - **What is archived.** `schedule.json`, `runs/` (run and step records, envelopes, prompts, call logs, the snapshot
 *   git stores) and `interruptions/` of an out-root. The agents' work trees (`runs/<runId>/work/`) are left out: every
 *   snapshot of them is in the run's snapshot store, and they hold the skeleton's `node_modules`. Symbolic links are
 *   never followed or archived; they are counted (`skippedLinks`), and their targets are not recorded (a target may be
 *   an absolute path).
 * - **Manifest.** One entry per file, sorted by POSIX path relative to the out-root: `{ path, bytes, sha256 }`.
 *   `manifestSha256` is the sha256 of the lines `<sha256>  <bytes>  <path>\n` in that order, so it depends only on
 *   the archived content and its relative paths, never on where the out-root lies or on file times.
 * - **Tarball.** A plain POSIX ustar written here (not by the system `tar`), in manifest order, with mtime 0, mode
 *   0644, uid/gid 0 and empty owner names, so the same content gives the same bytes and the same sha256 on any
 *   machine. A path longer than ustar allows (255 bytes, split at a `/`) stops the archive (`ARCHIVE_PATH_TOO_LONG`).
 * - **Path-free check.** `scanPathFree(dir)` lists, for every text file under a directory meant to be committed, the
 *   lines holding an absolute home path (`/Users/…`, `/home/…`, `/Volumes/…`) or a secret shape (the C10 scrubber's
 *   patterns: `scrubSecrets` changes the line). It reports file, line number and kind, never the matched text.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scrubSecrets } from '../../../src/shared/errors/scrub.js';
import { WORK_DIR } from './loop.js';

export const ARCHIVE_SCHEMA = 'loop-archive/v1';
export const ARCHIVED_TOP = Object.freeze(['schedule.json', 'runs', 'interruptions']);

export interface ArchiveEntry {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface ArchiveManifest {
  readonly schema: typeof ARCHIVE_SCHEMA;
  readonly files: number;
  readonly bytes: number;
  readonly skippedLinks: number;
  readonly manifestSha256: string;
  /** sha256 of the ustar bytes; null until a tarball is written. */
  readonly tarSha256: string | null;
  readonly entries: readonly ArchiveEntry[];
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');

/** True for `runs/<adapter>/<model>/<task>/<arm>/run-<r>/work` (the directory beside the run's `run.json`). */
function isWorkDir(abs: string): boolean {
  return path.basename(abs) === WORK_DIR && fs.existsSync(path.join(path.dirname(abs), 'run.json'));
}

/** The files to archive, as POSIX paths relative to the out-root, sorted; and the count of links skipped. */
export function archiveFiles(outRoot: string): { readonly files: readonly string[]; readonly skippedLinks: number } {
  const files: string[] = [];
  let skippedLinks = 0;
  const walk = (rel: string): void => {
    const abs = path.join(outRoot, ...rel.split('/'));
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) {
      skippedLinks++;
      return;
    }
    if (st.isFile()) {
      files.push(rel);
      return;
    }
    if (!st.isDirectory() || isWorkDir(abs)) return;
    for (const name of fs.readdirSync(abs).sort(cmp)) walk(`${rel}/${name}`);
  };
  for (const top of ARCHIVED_TOP) if (fs.existsSync(path.join(outRoot, top))) walk(top);
  files.sort(cmp);
  return { files, skippedLinks };
}

export function manifestDigest(entries: readonly ArchiveEntry[]): string {
  return sha256(entries.map((e) => `${e.sha256}  ${String(e.bytes)}  ${e.path}\n`).join(''));
}

export function buildManifest(outRoot: string): ArchiveManifest {
  const { files, skippedLinks } = archiveFiles(outRoot);
  const entries = files.map((rel) => {
    const b = fs.readFileSync(path.join(outRoot, ...rel.split('/')));
    return { path: rel, bytes: b.length, sha256: sha256(b) };
  });
  return {
    schema: ARCHIVE_SCHEMA,
    files: entries.length,
    bytes: entries.reduce((a, e) => a + e.bytes, 0),
    skippedLinks,
    manifestSha256: manifestDigest(entries),
    tarSha256: null,
    entries,
  };
}

// ── ustar ───────────────────────────────────────────────────────────────────

function octal(n: number, width: number): string {
  return `${n.toString(8).padStart(width - 1, '0')}\0`;
}

/** Splits a path into ustar `prefix` (≤ 155) and `name` (≤ 100) at a `/`; null when impossible. */
export function ustarSplit(p: string): { readonly prefix: string; readonly name: string } | null {
  if (Buffer.byteLength(p) <= 100) return { prefix: '', name: p };
  for (let i = p.indexOf('/'); i >= 0; i = p.indexOf('/', i + 1)) {
    const prefix = p.slice(0, i);
    const name = p.slice(i + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100 && name !== '') return { prefix, name };
  }
  return null;
}

function header(p: string, size: number): Buffer {
  const split = ustarSplit(p);
  if (split === null) throw Object.assign(new Error(`ARCHIVE_PATH_TOO_LONG: ${p}`), { code: 'ARCHIVE_PATH_TOO_LONG' });
  const h = Buffer.alloc(512, 0);
  h.write(split.name, 0, 100, 'utf8');
  h.write(octal(0o644, 8), 100, 'ascii');
  h.write(octal(0, 8), 108, 'ascii');
  h.write(octal(0, 8), 116, 'ascii');
  h.write(octal(size, 12), 124, 'ascii');
  h.write(octal(0, 12), 136, 'ascii');
  h.write('        ', 148, 'ascii');
  h.write('0', 156, 'ascii');
  h.write('ustar\0', 257, 'ascii');
  h.write('00', 263, 'ascii');
  h.write(split.prefix, 345, 155, 'utf8');
  let sum = 0;
  for (const byte of h) sum += byte;
  h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
  return h;
}

/** Writes the ustar of the manifest's files to `tarFile`; returns its sha256. */
export function writeTar(outRoot: string, manifest: ArchiveManifest, tarFile: string): string {
  const hash = createHash('sha256');
  const fd = fs.openSync(tarFile, 'w');
  const put = (b: Buffer): void => {
    fs.writeSync(fd, b);
    hash.update(b);
  };
  try {
    for (const e of manifest.entries) {
      const body = fs.readFileSync(path.join(outRoot, ...e.path.split('/')));
      if (sha256(body) !== e.sha256) throw new Error(`ARCHIVE_CHANGED: ${e.path} changed since the manifest was built`);
      put(header(e.path, body.length));
      put(body);
      const padTo = (512 - (body.length % 512)) % 512;
      if (padTo > 0) put(Buffer.alloc(padTo, 0));
    }
    put(Buffer.alloc(1024, 0));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

/** Manifest plus tarball; the returned manifest carries `tarSha256`. */
export function archiveOutRoot(outRoot: string, tarFile: string): ArchiveManifest {
  const rel = path.relative(path.resolve(outRoot), path.resolve(tarFile));
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) throw new Error('ARCHIVE_INSIDE_OUTROOT: the tarball must lie outside the out-root');
  const m = buildManifest(outRoot);
  return { ...m, tarSha256: writeTar(outRoot, m, tarFile) };
}

/** Differences between a committed manifest and the out-root as it is now (empty when they agree). */
export function verifyManifest(outRoot: string, committed: ArchiveManifest): string[] {
  const now = buildManifest(outRoot);
  const problems: string[] = [];
  if (manifestDigest(committed.entries) !== committed.manifestSha256) problems.push('the committed manifest does not hash to its manifestSha256');
  if (now.manifestSha256 !== committed.manifestSha256) {
    const want = new Map(committed.entries.map((e) => [e.path, e.sha256]));
    const got = new Map(now.entries.map((e) => [e.path, e.sha256]));
    for (const [p, h] of want) if (got.get(p) !== h) problems.push(got.has(p) ? `changed: ${p}` : `missing: ${p}`);
    for (const p of got.keys()) if (!want.has(p)) problems.push(`added: ${p}`);
    if (problems.length === 0) problems.push('manifestSha256 differs');
  }
  return problems;
}

// ── Path-free check ─────────────────────────────────────────────────────────

export interface PathFreeHit {
  /** Relative to the scanned directory (POSIX). */
  readonly file: string;
  readonly line: number;
  readonly kind: 'absolute-home-path' | 'secret-shape';
}

export const HOME_PATH_RE = /\/(?:Users|home|Volumes)\/[^\s"'`/]+/;
const SCAN_MAX_BYTES = 8 * 1024 * 1024;

function isText(b: Buffer): boolean {
  return !b.subarray(0, Math.min(b.length, 8192)).includes(0);
}

export function scanPathFree(dir: string): PathFreeHit[] {
  const hits: PathFreeHit[] = [];
  const walk = (rel: string): void => {
    const abs = rel === '' ? dir : path.join(dir, ...rel.split('/'));
    const st = fs.lstatSync(abs);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(abs).sort(cmp)) if (name !== '.git' && name !== 'node_modules') walk(rel === '' ? name : `${rel}/${name}`);
      return;
    }
    if (!st.isFile() || st.size > SCAN_MAX_BYTES) return;
    const b = fs.readFileSync(abs);
    if (!isText(b)) return;
    b.toString('utf8')
      .split('\n')
      .forEach((line, i) => {
        if (HOME_PATH_RE.test(line)) hits.push({ file: rel, line: i + 1, kind: 'absolute-home-path' });
        if (scrubSecrets(line, []) !== line) hits.push({ file: rel, line: i + 1, kind: 'secret-shape' });
      });
  };
  walk('');
  return hits;
}
