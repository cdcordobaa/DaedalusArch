/**
 * U4 (v1.5-exp): the 13 human DDD repositories of `ops/notes/detect-02-precision-note.md` §7, at their pinned SHAs
 * (read from the three frozen `results/v1.3-external…/selection.json` files), and the spec variants the
 * S3 conditions run on.
 * DEVELOPMENT MATERIAL ONLY. Clones live outside the repository (`--clones <dir>`, layout `<dir>/<id>`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';

export const REPO_IDS = [
  'ddd-forum', 'finance-project-ddd', 'event-sourcing-ddd', 'pezzetti-base-app', 'talyssonoc-node-api', 'camps-graphql-api', 'mustodon',
  'meetinger', 'ddd-libellis', 'miczeq-nodejs-ddd', 'dlydiard-ddd-cqrs-es', 'lucashang-ddd-payday', 'quiz4devs-backend',
] as const;
const WAVES = ['results/v1.3-external', 'results/v1.3-external-2', 'results/v1.3-external-3'];

export interface Repo { readonly id: string; readonly url: string; readonly sha: string; readonly root: string; readonly tsconfig: string; readonly spec: string; readonly style: string }

export function repos(): Repo[] {
  const out: Repo[] = [];
  for (const w of WAVES) {
    const d = JSON.parse(fs.readFileSync(path.join(w, 'selection.json'), 'utf8')) as unknown;
    const items = (Array.isArray(d) ? d : Object.values(d as Record<string, unknown>).find(Array.isArray)) as Record<string, string>[];
    for (const e of items) {
      if (!(REPO_IDS as readonly string[]).includes(e['id']!)) continue;
      out.push({ id: e['id']!, url: e['url']!, sha: e['sha']!, root: e['root'] ?? '.', tsconfig: e['tsconfig'] ?? 'tsconfig.json', spec: path.join(w, 'specs', `${e['id']!}.yaml`), style: e['style']! });
    }
  }
  return REPO_IDS.map((id) => { const r = out.find((x) => x.id === id); if (!r) throw new Error(`no selection entry for ${id}`); return r; });
}

export const treeOf = (clones: string, r: Repo): string => path.join(clones, r.id, r.root);

export interface DeclaredAggregate { readonly name: string; readonly context: string; readonly module: string; readonly root: string; readonly inner_entities?: readonly string[] }
export interface SpecDoc { architecture: { ddd?: { contexts?: { name: string; root: string }[]; aggregates?: DeclaredAggregate[] } & Record<string, unknown> } & Record<string, unknown> }

export const readSpec = (r: Repo): SpecDoc => YAML.parse(fs.readFileSync(r.spec, 'utf8')) as SpecDoc;

/** Writes a variant of the repository's spec with the `aggregates` block replaced (`null` removes it). */
export function writeVariant(r: Repo, dir: string, name: string, aggregates: readonly DeclaredAggregate[] | null): string {
  const doc = readSpec(r);
  const ddd = doc.architecture.ddd ?? {};
  if (aggregates === null || aggregates.length === 0) delete ddd.aggregates;
  else ddd.aggregates = [...aggregates];
  doc.architecture.ddd = ddd;
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${r.id}.${name}.yaml`);
  fs.writeFileSync(p, YAML.stringify(doc));
  return p;
}
