/**
 * SEM-GATE-2 census (zero model calls): the R-MIRROR-SEM candidates of every SEM-GATE tree (the 12 built trees and the
 * final tree of each of the 220 kept Hexagonal study sessions, each with its spec and baseline), and of the SEM-GATE-2
 * cases when `--cases` is given. Run it before and after a change to the candidate structure and compare the two files
 * (`compare-census.ts`): the content-hash key of every asked candidate shows whether the judge's question changed.
 *
 *   npx tsx experiments/sem-gate-2/census-all.ts --kept <dir> --out <file.json> [--cases experiments/sem-gate-2/cases.json]
 *
 * `<kept>` is `git archive 5f69990e4482 results/v1.5-hx-study/hx-study | tar -x` (sessions, private-id-map).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildGraph } from '../../src/v15-instrument/index.js';
import { mirrorKeyOf, structureHolds } from '../../src/v15-instrument/mirror-sem.js';

const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };

interface T { id: string; tree: string; spec: string; baseline?: string }
interface BuiltCase { id: string; source: string; tree?: string; spec: string; baseline?: string }

async function main(): Promise<void> {
  const kept = argOf('--kept'); const out = argOf('--out');
  if (kept === undefined || out === undefined) throw new Error('--kept <dir> and --out <file> are required');
  const list: T[] = [];
  const built = (file: string, prefix: string): void => {
    const man = JSON.parse(fs.readFileSync(file, 'utf8')) as { cases: BuiltCase[] };
    for (const c of man.cases) if (c.source === 'built') list.push({ id: `${prefix}/${c.id}`, tree: c.tree!, spec: c.spec, ...(c.baseline !== undefined ? { baseline: c.baseline } : {}) });
  };
  built('experiments/sem-gate/cases.json', 'sem-gate');
  const extra = argOf('--cases');
  if (extra !== undefined) built(extra, 'sem-gate-2');
  const idMap = JSON.parse(fs.readFileSync(path.join(kept, 'private-id-map.json'), 'utf8')) as Record<string, { task: string }>;
  const set = JSON.parse(fs.readFileSync('experiments/hx-study-set/study-set.json', 'utf8')) as { taskDirs: Record<string, string> };
  const sdir = path.join(kept, 'sessions');
  for (const s of fs.readdirSync(sdir).sort()) {
    const sj = JSON.parse(fs.readFileSync(path.join(sdir, s, 'session.json'), 'utf8')) as { taskId: string };
    const task = idMap[sj.taskId]!.task;
    const snap = path.join(sdir, s, 'snap');
    const steps = fs.readdirSync(snap).filter((d) => /^step-\d+$/.test(d)).sort();
    list.push({ id: `kept/${s}`, tree: path.join(snap, steps.at(-1)!), baseline: path.join(snap, steps[0]!), spec: path.join(set.taskDirs[task]!, 'spec.yaml') });
  }
  const rows: Record<string, unknown>[] = [];
  for (const t of list) {
    const { facts } = await buildGraph(t.tree, { spec: t.spec, withApg: false, ...(t.baseline !== undefined ? { baseline: t.baseline } : {}) });
    for (const c of facts.mirrorCandidates) {
      const side = (c as { mapSide?: string }).mapSide ?? 'adapter';
      rows.push({
        tree: t.id, file: c.file, coreSet: c.coreSet, vendor: `${c.vendorSet} of ${c.module}`, mapSide: side,
        coreMembers: c.coreMembers, pairs: c.pairs.map((p) => `${p.from}->${p.to} (${p.form})`), mappedFrom: c.mappedFrom, mappedTo: c.mappedTo, oneToOne: c.oneToOne,
        branches: c.branches.length, ownedBy: c.ownedBy, asked: structureHolds(c), key: structureHolds(c) ? mirrorKeyOf(c).slice(0, 24) : null,
      });
    }
    process.stderr.write(`${t.id} ${String(facts.mirrorCandidates.length)}\n`);
  }
  fs.writeFileSync(out, `${JSON.stringify({ trees: list.length, candidates: rows.length, asked: rows.filter((r) => r['asked']).length, rows }, null, 1)}\n`);
}
void main();
