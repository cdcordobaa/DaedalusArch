import { posix } from 'node:path';

export type Rec = Readonly<Record<string, unknown>>;

export function isRec(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

export function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) return Number(v);
  return undefined;
}

export function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** First string-valued property of `r` among `keys`. */
export function pick(r: Rec, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const s = str(r[k]);
    if (s !== undefined) return s;
  }
  return undefined;
}

/** POSIX, project-relative, no leading `./` or `/`. */
export function normPath(p: string): string {
  const n = posix.normalize(p.replace(/\\/g, '/'));
  return n.replace(/^(\.\/)+/, '').replace(/^\/+/, '');
}

export function baseName(p: string): string {
  return posix.basename(p);
}

/** `L42`, `42`, `42-50` → 42. */
export function parseLine(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const m = /(\d+)/.exec(v);
  return m?.[1] === undefined ? undefined : Number(m[1]);
}

export function parseJson(input: unknown): unknown {
  return typeof input === 'string' ? (JSON.parse(input) as unknown) : input;
}

const SOURCE_EXT = /\.(?:[cm]?[jt]sx?)$/i;

export function isSourceFile(p: string): boolean {
  return SOURCE_EXT.test(p) && !p.endsWith('.d.ts');
}

/**
 * Qualified-method owner lookup: for a method named `Class.method` (or with a `ownerName` hint) without an
 * explicit owner, the class or interface node of the same file with that name.
 */
export function ownerIdByName(
  nodes: readonly { id: string; kind: string; name: string; filePath?: string }[],
  filePath: string | undefined,
  ownerName: string | undefined,
): string | undefined {
  if (filePath === undefined || ownerName === undefined) return undefined;
  const hit = nodes.find((n) => (n.kind === 'class' || n.kind === 'interface') && n.name === ownerName && n.filePath === filePath);
  return hit?.id;
}

/** Longest common directory prefix of absolute POSIX paths ('' when there is none or any path is relative). */
export function commonDirPrefix(paths: readonly string[]): string {
  if (paths.length === 0 || paths.some((p) => !p.startsWith('/'))) return '';
  const split = paths.map((p) => p.split('/').slice(0, -1));
  const first = split[0] ?? [];
  let n = first.length;
  for (const parts of split) {
    let i = 0;
    while (i < n && parts[i] === first[i]) i++;
    n = i;
  }
  return first.slice(0, n).join('/');
}

/** Backslashes to slashes only: keeps a leading `/` so absolute paths stay recognisable until `relativise`. */
export function slashPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Property read by a computed key (the `Record<string, T>` index access the lint and compiler settings disagree on). */
export function field<T>(r: Readonly<Record<string, T>>, key: string): T | undefined {
  return r[key];
}

/** Record-valued property, `{}` when absent or not a record. */
export function recField(r: Rec, key: string): Rec {
  const v = r[key];
  return isRec(v) ? v : {};
}

/** Array-valued property, `[]` when absent or not an array. */
export function arrField(r: Rec, key: string): unknown[] {
  const v = r[key];
  return Array.isArray(v) ? (v as unknown[]) : [];
}
