/**
 * v1.3 labeller calibration: pinned downloads and code resolution. Every byte that enters a prompt is fetched at a
 * pinned version and hashed: dataset files by their published md5 (Zenodo) or a git commit, code by
 * `raw.githubusercontent.com/<owner>/<repo>/<commit>/<path>` at the dataset's own commit, then sliced to the
 * dataset's line range. Downloads go to a data directory outside the repository; nothing fetched is committed except
 * hashes. Fetched files are data only: nothing here executes them.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CalibrationItem, ResolvedItem } from './types.js';

export type Fetcher = (url: string) => Promise<{ readonly status: number; readonly body: Buffer }>;

export const nodeFetcher: Fetcher = async (url) => {
  const r = await fetch(url, { redirect: 'follow' });
  return { status: r.status, body: Buffer.from(await r.arrayBuffer()) };
};

export interface ZenodoFile {
  readonly name: string;
  readonly url: string;
  /** `md5:<hex>` as published by the Zenodo API. */
  readonly checksum: string;
  readonly size: number;
}

export interface DatasetSource {
  readonly dataset: string;
  readonly doi: string;
  readonly licence: string;
  readonly files: readonly ZenodoFile[];
}

export const md5 = (b: Buffer | string): string => createHash('md5').update(b).digest('hex');
export const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');

/** Downloads (or re-uses) every file of a source into `<dataDir>/<dataset>/`, verifying the published checksum. */
export async function fetchSource(src: DatasetSource, dataDir: string, fetcher: Fetcher = nodeFetcher, log: (l: string) => void = () => undefined): Promise<string[]> {
  const dir = path.join(dataDir, src.dataset);
  fs.mkdirSync(dir, { recursive: true });
  const out: string[] = [];
  for (const f of src.files) {
    const file = path.join(dir, f.name);
    const want = f.checksum.replace(/^md5:/, '');
    if (fs.existsSync(file) && md5(fs.readFileSync(file)) === want) {
      log(`${src.dataset}/${f.name}: present, md5 ok`);
      out.push(file);
      continue;
    }
    const r = await fetcher(f.url);
    if (r.status !== 200) throw new Error(`${f.url}: HTTP ${String(r.status)}`);
    const got = md5(r.body);
    if (got !== want) throw new Error(`${src.dataset}/${f.name}: md5 ${got} differs from the pinned ${want}`);
    fs.writeFileSync(file, r.body);
    log(`${src.dataset}/${f.name}: downloaded, md5 ok`);
    out.push(file);
  }
  return out;
}

/** `codesplit_java_method/<p>/<p>/<package>/<Class>/<method>.code` → `<package>/<Class>.java` (the unit's file). */
export function archiveDisplayPath(entry: string): string {
  const parts = entry.replace(/\.code$/, '').split('/').filter((p) => p !== '');
  const method = parts[0] === 'codesplit_java_method';
  const pkg = parts[3] ?? '';
  const cls = method ? (parts[4] ?? '') : (parts[parts.length - 1] ?? '');
  return pkg === '' || pkg === '(default package)' ? `${cls}.java` : `${pkg.replace(/\./g, '/')}/${cls}.java`;
}

export function rawUrl(item: CalibrationItem): string | null {
  const loc = item.location;
  if (loc === undefined) return null;
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(loc.repository);
  if (m === null || !/^[0-9a-f]{40}$/.test(loc.commit)) return null;
  const p = loc.path.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${m[1] ?? ''}/${m[2] ?? ''}/${loc.commit}/${p}`;
}

/** Lines `start..end` (1-based, inclusive) of `text`; null when the range is outside the file. */
export function sliceLines(text: string, start: number, end: number): string | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (start < 1 || end < start || end > lines.length) return null;
  return lines.slice(start - 1, end).join('\n');
}

/**
 * Resolves an item's code: the file is fetched once per (repository, commit, path) and cached under
 * `<dataDir>/code/<sha256(url)>`; a 404 is cached as a miss so a resolution is reproducible offline.
 */
export function codeResolver(dataDir: string, fetcher: Fetcher = nodeFetcher, offline = false, archive?: (entry: string) => string | null) {
  const dir = path.join(dataDir, 'code');
  fs.mkdirSync(dir, { recursive: true });
  return async (item: CalibrationItem): Promise<ResolvedItem | { readonly skip: string }> => {
    if (item.archiveEntry !== undefined) {
      const code = archive?.(item.archiveEntry) ?? null;
      if (code === null) return { skip: 'not in the code archive' };
      if (code.trim() === '') return { skip: 'empty unit' };
      return { ...item, code, codeSha256: sha256(code), displayPath: archiveDisplayPath(item.archiveEntry) };
    }
    const url = rawUrl(item);
    const loc = item.location;
    if (url === null || loc === undefined) return { skip: 'no pinned GitHub location' };
    const cache = path.join(dir, sha256(url));
    let text: string;
    if (fs.existsSync(cache)) text = fs.readFileSync(cache, 'utf8');
    else if (fs.existsSync(`${cache}.miss`)) return { skip: `HTTP ${fs.readFileSync(`${cache}.miss`, 'utf8')}` };
    else {
      if (offline) return { skip: 'not cached (offline)' };
      const r = await fetcher(url);
      if (r.status !== 200) {
        fs.writeFileSync(`${cache}.miss`, String(r.status));
        return { skip: `HTTP ${String(r.status)}` };
      }
      text = r.body.toString('utf8');
      fs.writeFileSync(cache, text);
    }
    const code = loc.startLine === undefined || loc.endLine === undefined ? text : sliceLines(text, loc.startLine, loc.endLine);
    if (code === null) return { skip: 'line range outside the file' };
    if (code.trim() === '') return { skip: 'empty unit' };
    return { ...item, code, codeSha256: sha256(code), displayPath: loc.path };
  };
}
