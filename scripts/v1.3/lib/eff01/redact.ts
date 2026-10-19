/**
 * Personal-path redaction of every file written to the EFF-01 run dir (design DR-27a). The run dir is committed to a
 * public repository; argv, MCP config, tool inputs and outputs and the call log carry absolute paths.
 *
 * Roots are replaced longest prefix first (so a harness root inside `HOME` becomes `<H>`, not `<HOME>/…`), each also in
 * its canonical (symlink-resolved) spelling, and only at a path boundary.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface RedactRoot {
  readonly prefix: string;
  readonly token: string;
}

export interface RedactInput {
  readonly harnessRoot?: string;
  readonly repoRoot?: string;
  readonly clonesDir?: string;
  readonly configDir?: string;
  readonly nodeBinary?: string;
  readonly home?: string;
}

function realOrSelf(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

function strip(p: string): string {
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

/** The redaction roots, longest prefix first. Empty or `/` roots are skipped. */
export function redactRoots(input: RedactInput): readonly RedactRoot[] {
  const pairs: [string | undefined, string][] = [
    [input.harnessRoot, '<H>'],
    [input.repoRoot, '<REPO>'],
    [input.clonesDir, '<CLONES>'],
    [input.configDir, '<CONFIG>'],
    [input.nodeBinary === undefined ? undefined : path.dirname(input.nodeBinary), '<NODE>'],
    [input.home, '<HOME>'],
  ];
  const roots: RedactRoot[] = [];
  const seen = new Set<string>();
  for (const [p, token] of pairs) {
    if (p === undefined || p === '' || !path.isAbsolute(p)) continue;
    for (const spelling of [strip(p), strip(realOrSelf(p))]) {
      if (spelling === '/' || seen.has(spelling)) continue;
      seen.add(spelling);
      roots.push({ prefix: spelling, token });
    }
  }
  return roots.sort((a, b) => b.prefix.length - a.prefix.length || (a.prefix < b.prefix ? -1 : 1));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replaces every root in one string, at path boundaries only. */
export function redactString(s: string, roots: readonly RedactRoot[]): string {
  let out = s;
  for (const r of roots) {
    if (!out.includes(r.prefix)) continue;
    out = out.replace(new RegExp(`${escapeRe(r.prefix)}(?![A-Za-z0-9._-])`, 'g'), r.token);
  }
  return out;
}

/** Deep redaction of strings (values and keys) in a JSON-like value. */
export function redactPaths<T>(value: T, roots: readonly RedactRoot[]): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return redactString(v, roots);
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === 'object' && v !== null) {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [redactString(k, roots), walk(x)]));
    }
    return v;
  };
  return walk(value) as T;
}

/** Redacts each JSONL line: parsed lines deeply, unparsable lines as text. */
export function redactJsonl(text: string, roots: readonly RedactRoot[]): string {
  return text
    .split('\n')
    .map((line) => {
      if (line.trim() === '') return line;
      try {
        return JSON.stringify(redactPaths(JSON.parse(line) as unknown, roots));
      } catch {
        return redactString(line, roots);
      }
    })
    .join('\n');
}
