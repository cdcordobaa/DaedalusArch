/**
 * COMPREHEND-01 bank and trees: loading, and resolving each tree to a directory. In-repo trees are committed paths;
 * external trees are clones under `--clones <dir>` (`<dir>/<id>`) whose HEAD must equal the pinned SHA. Zero model calls.
 */
import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const HERE = 'experiments/comprehend-01';

export type ItemType = 'W' | 'O' | 'C' | 'I' | 'P' | 'R';
export type ItemClass = 'G' | 'Gw' | 'S' | 'X';
export interface Scoring {
  readonly kind: 'set' | 'exact' | 'chain' | 'path';
  readonly required?: readonly string[];
  readonly full?: readonly string[];
  readonly half?: readonly string[];
}
export interface Item {
  readonly id: string; readonly tree: string; readonly type: ItemType; readonly template: string; readonly class: ItemClass;
  readonly behaviour?: string; readonly text: string; readonly answerFormat: Record<string, unknown>;
  readonly key: Record<string, unknown>; readonly scoring: Scoring; readonly provenance: Record<string, unknown>;
}
export interface Bank { readonly schema: string; readonly items: readonly Item[] }
export interface TreeDecl {
  readonly id: string; readonly kind: string; readonly path?: string; readonly spec: string;
  readonly repo?: string; readonly url?: string; readonly sha?: string; readonly root?: string; readonly tsconfig?: string;
}
export interface ResolvedTree { readonly decl: TreeDecl; readonly dir: string; readonly spec: string; readonly tsconfig: string | undefined }

export const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
export const sha256 = (s: string | Buffer): string => crypto.createHash('sha256').update(s).digest('hex');

export function loadBank(): { bank: Bank; sha256: string; conventions: string[] } {
  const raw = fs.readFileSync(path.join(HERE, 'questions', 'bank.json'), 'utf8');
  const conv = readJson<{ conventions: string[] }>(path.join(HERE, 'questions', 'conventions.json')).conventions;
  return { bank: JSON.parse(raw) as Bank, sha256: sha256(raw), conventions: conv };
}

export function loadTrees(): TreeDecl[] {
  return readJson<{ trees: TreeDecl[] }>(path.join(HERE, 'trees.json')).trees;
}

/** Resolve every tree; an external tree needs `clones` and a clone at the pinned SHA. Problems are returned, not thrown. */
export function resolveTrees(clones: string | undefined): { trees: Map<string, ResolvedTree>; problems: string[] } {
  const trees = new Map<string, ResolvedTree>();
  const problems: string[] = [];
  for (const t of loadTrees()) {
    if (t.path !== undefined) {
      if (!fs.existsSync(path.join(t.path, 'src'))) { problems.push(`${t.id}: no src/ under ${t.path}`); continue; }
      trees.set(t.id, { decl: t, dir: path.resolve(t.path), spec: path.resolve(t.spec), tsconfig: undefined });
      continue;
    }
    if (clones === undefined) { problems.push(`${t.id}: external tree, pass --clones <dir>`); continue; }
    const clone = path.resolve(clones, t.id);
    if (!fs.existsSync(clone)) { problems.push(`${t.id}: no clone at <clones>/${t.id} (git clone ${t.url ?? ''} and check out ${t.sha ?? ''})`); continue; }
    let head = '';
    try { head = execFileSync('git', ['-C', clone, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { head = '?'; }
    if (head !== t.sha) { problems.push(`${t.id}: clone HEAD ${head} is not the pin ${t.sha ?? ''}`); continue; }
    const dir = path.join(clone, t.root ?? '.');
    trees.set(t.id, { decl: t, dir, spec: path.resolve(t.spec), tsconfig: t.tsconfig !== undefined ? path.join(dir, t.tsconfig) : undefined });
  }
  return { trees, problems };
}

/** Remove absolute paths of this checkout, the clones and the temp dir from text written to results. */
export function scrubber(roots: readonly string[]): (s: string) => string {
  const rs = [...new Set(roots.filter((r) => r !== '' && r !== '/'))].sort((a, b) => b.length - a.length);
  return (s) => rs.reduce((acc, r) => acc.split(r).join(r === path.resolve('.') ? '.' : '<clones>'), s);
}
