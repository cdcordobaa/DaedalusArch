/**
 * Gate line V11 (no leakage): does any text of the sealed 2b task set appear in a file a 2b agent could read?
 * Hashes only: the sealed files are read in-process, turned into hashed word 8-grams and whole-file sha256s, and
 * never printed. A scanned file "hits" when it shares a hashed 8-gram with the sealed set. A hit on an 8-gram that also
 * occurs in the public baseline (practice tasks and practice acceptance files, written independently and committed)
 * is shared boilerplate, not leakage, and is counted apart.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const NGRAM = 8;
/** The leak rule's span, in words (see `scripts/v1.4/leakage-scan.ts`). */
export const LEAK_SPAN = 20;
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

const h = (s: string): string => createHash('sha256').update(s).digest('hex');

/** Lower-cased alphanumeric words; JSON and string escapes (`\n`, `\t`, `\"`, `\r`) become spaces first. */
export function words(text: string): string[] {
  return text.replace(/\\[nrt"]/g, ' ').toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Hashed word n-grams of a text, in word order (first 32 hex chars of sha256 of the space-joined window). */
export function ngramSequence(text: string, n = NGRAM): string[] {
  const w = words(text);
  const out: string[] = [];
  for (let i = 0; i + n <= w.length; i++) out.push(h(w.slice(i, i + n).join(' ')).slice(0, 32));
  return out;
}

export function ngramHashes(text: string, n = NGRAM): Set<string> {
  return new Set(ngramSequence(text, n));
}

/**
 * The longest run of words a text shares verbatim with the sealed set, in words (0 when no window is shared): the
 * longest stretch of consecutive positions whose window is sealed, plus n - 1. Baseline windows are skipped when
 * `baseline` is given, so the span is the longest stretch that the public baseline does not explain.
 */
export function longestSharedSpan(seq: readonly string[], sealed: Set<string>, baseline?: Set<string>, n = NGRAM): number {
  let best = 0;
  let run = 0;
  for (const g of seq) {
    if (sealed.has(g) && !(baseline?.has(g) ?? false)) {
      run += 1;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best === 0 ? 0 : best + n - 1;
}

/** Every string value of a JSON document, depth first. */
export function jsonStrings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(jsonStrings);
  if (v !== null && typeof v === 'object') return Object.values(v as Record<string, unknown>).flatMap(jsonStrings);
  return [];
}

/** The text of a file for n-gram purposes: JSON is reduced to its string values, joined by newlines. */
export function fileText(buf: Buffer, name: string): string | null {
  if (buf.includes(0)) return null; // binary
  const s = buf.toString('utf8');
  if (name.endsWith('.json')) {
    try {
      return jsonStrings(JSON.parse(s) as unknown).join('\n');
    } catch {
      return s;
    }
  }
  return s;
}

export interface WalkOptions {
  /** Directory names never entered. */
  readonly skipDirs: readonly string[];
}

/** Regular files under a root (symlinks not followed), sorted. */
export function walk(root: string, opts: WalkOptions): string[] {
  const out: string[] = [];
  const rec = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!opts.skipDirs.includes(e.name)) rec(p);
      } else if (e.isFile()) out.push(p);
    }
  };
  rec(root);
  return out;
}

export interface SealedIndex {
  readonly files: number;
  readonly ngrams: Set<string>;
  readonly fileSha256: Set<string>;
}

export function indexFiles(files: readonly string[]): SealedIndex {
  const ngrams = new Set<string>();
  const fileSha256 = new Set<string>();
  for (const f of files) {
    const buf = fs.readFileSync(f);
    if (buf.length > 0) fileSha256.add(h(buf.toString('binary'))); // an empty file matches every empty file: no signal
    const t = fileText(buf, f);
    if (t !== null) for (const g of ngramHashes(t)) ngrams.add(g);
  }
  return { files: files.length, ngrams, fileSha256 };
}

const fileHash = (buf: Buffer): string => h(buf.toString('binary'));

export interface FileHit {
  readonly file: string;
  /** Distinct sealed 8-grams in the file. */
  readonly hits: number;
  /** Of those, the ones not in the public baseline. */
  readonly unexplained: number;
  /** Longest verbatim run (words) shared with the sealed set and not explained by the baseline. */
  readonly longestSpan: number;
  readonly wholeFileMatch: boolean;
}

export interface RootReport {
  readonly root: string;
  readonly files: number;
  readonly textFiles: number;
  readonly skippedLarge: number;
  readonly bytes: number;
  readonly filesWithHits: number;
  readonly filesWithUnexplainedHits: number;
  readonly wholeFileMatches: number;
  /** The largest `longestSpan` of any file under the root. */
  readonly maxSpan: number;
  /** Distinct sealed 8-grams found anywhere under the root, outside the baseline. */
  readonly distinctUnexplained: number;
  readonly hits: readonly FileHit[];
}

/** Scans one root against the sealed index; file paths are reported relative to the root. */
export function scanRoot(root: string, label: string, sealed: SealedIndex, baseline: Set<string>, opts: WalkOptions): RootReport {
  let textFiles = 0;
  let skippedLarge = 0;
  let bytes = 0;
  const hits: FileHit[] = [];
  const seen = new Set<string>();
  const files = walk(root, opts);
  for (const f of files) {
    let size: number;
    try {
      size = fs.statSync(f).size;
    } catch {
      continue;
    }
    if (size > MAX_FILE_BYTES) {
      skippedLarge += 1;
      continue;
    }
    const buf = fs.readFileSync(f);
    bytes += buf.length;
    const whole = buf.length > 0 && sealed.fileSha256.has(fileHash(buf));
    const t = fileText(buf, f);
    let n = 0;
    let u = 0;
    let span = 0;
    if (t !== null) {
      textFiles += 1;
      const seq = ngramSequence(t);
      for (const g of new Set(seq)) {
        if (!sealed.ngrams.has(g)) continue;
        n += 1;
        if (!baseline.has(g)) {
          u += 1;
          seen.add(g);
        }
      }
      if (u > 0) span = longestSharedSpan(seq, sealed.ngrams, baseline);
    }
    if (n > 0 || whole) hits.push({ file: path.relative(root, f).split(path.sep).join('/'), hits: n, unexplained: u, longestSpan: span, wholeFileMatch: whole });
  }
  return {
    root: label, files: files.length, textFiles, skippedLarge, bytes,
    filesWithHits: hits.filter((x) => x.hits > 0).length,
    filesWithUnexplainedHits: hits.filter((x) => x.unexplained > 0).length,
    wholeFileMatches: hits.filter((x) => x.wholeFileMatch).length,
    maxSpan: hits.reduce((a, x) => Math.max(a, x.longestSpan), 0),
    distinctUnexplained: seen.size,
    hits,
  };
}
