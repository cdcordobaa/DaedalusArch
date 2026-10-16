/**
 * v1.3-validity-predictive, prespec addendum 3 (R11): import-cycle membership without the FF-S02 row cap.
 *
 *   node --import tsx scripts/v1.3/predictive/scc.ts --snapshots <dir with <id>.<label>/ extractions>
 *
 * For every exposure/<id>.<label>.csv: the default APG (same harness tsconfig and spec exclusions as exposure.ts),
 * file-level IMPORTS / RE_EXPORTS edges, Tarjan's strongly connected components; writes exposure/<id>.<label>.scc.csv
 * (file, size of its component; 1 = on no cycle). Skips outputs that exist.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { specExcludePathsFromYaml } from '../../../src/spec-parser/index.js';

const OUT = path.join(process.cwd(), 'results/v1.3-validity-predictive');
const i = process.argv.indexOf('--snapshots');
const SNAP: string = process.argv[i + 1] ?? '';
if (i < 0 || SNAP === '') throw new Error('--snapshots is required');
const sel = JSON.parse(fs.readFileSync(path.join(OUT, 'selection.json'), 'utf8')) as { entries: { id: string; root: string }[] };

/** Component size per node (iterative Tarjan). */
export function sccSizes(nodes: readonly string[], adj: ReadonlyMap<string, readonly string[]>): Map<string, number> {
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const on = new Set<string>();
  const stack: string[] = [];
  const size = new Map<string, number>();
  for (const s of nodes) {
    if (idx.has(s)) continue;
    const work: [string, number][] = [[s, 0]];
    idx.set(s, index); low.set(s, index); index++; stack.push(s); on.add(s);
    while (work.length) {
      const top = work[work.length - 1]!;
      const [v, k] = top;
      const nb = adj.get(v) ?? [];
      if (k < nb.length) {
        top[1]++;
        const w = nb[k]!;
        if (!idx.has(w)) { idx.set(w, index); low.set(w, index); index++; stack.push(w); on.add(w); work.push([w, 0]); }
        else if (on.has(w)) low.set(v, Math.min(low.get(v)!, idx.get(w)!));
      } else {
        work.pop();
        if (work.length) { const u = work[work.length - 1]![0]; low.set(u, Math.min(low.get(u)!, low.get(v)!)); }
        if (low.get(v) === idx.get(v)) {
          const comp: string[] = [];
          let w: string;
          do { w = stack.pop()!; on.delete(w); comp.push(w); } while (w !== v);
          for (const c of comp) size.set(c, comp.length);
        }
      }
    }
  }
  return size;
}

async function main(): Promise<void> {
  for (const f of fs.readdirSync(path.join(OUT, 'exposure')).filter((x) => /\.(T|T_alt)\.csv$/.test(x)).sort()) {
    const target = path.join(OUT, 'exposure', f.replace(/\.csv$/, '.scc.csv'));
    if (fs.existsSync(target)) continue;
    const key = f.replace(/\.csv$/, '');
    const id = key.replace(/\.(T|T_alt)$/, '');
    const e = sel.entries.find((x) => x.id === id)!;
    const project = path.join(SNAP, key, e.root);
    const harness = path.join(project, 'tsconfig.predictive.json');
    if (!fs.existsSync(harness)) { process.stderr.write(`${key}: snapshot missing\n`); continue; }
    const excludes = specExcludePathsFromYaml(fs.readFileSync(path.join(OUT, 'specs', `${id}.yaml`), 'utf8'));
    const apg = await extractAPG(project, { excludePatterns: excludes }, harness);
    if (!apg.success) throw new Error(`${key}: extractAPG failed`);
    const fileOf = new Map<string, string>();
    for (const n of apg.data.nodes) if (n.type === 'File') fileOf.set(n.id, path.isAbsolute(n.filePath) ? path.relative(project, n.filePath) : n.filePath);
    const adj = new Map<string, string[]>();
    for (const ed of apg.data.edges) {
      if (ed.type !== 'IMPORTS' && ed.type !== 'RE_EXPORTS') continue;
      const s = fileOf.get(ed.sourceId);
      const t = fileOf.get(ed.targetId);
      if (s === undefined || t === undefined || s === t) continue;
      (adj.get(s) ?? adj.set(s, []).get(s)!).push(t);
    }
    const files = fs.readFileSync(path.join(OUT, 'exposure', f), 'utf8').trim().split('\n').slice(1).map((l) => JSON.parse(l.slice(0, l.indexOf('",') + 1)) as string);
    const sizes = sccSizes([...fileOf.values()].sort(), adj);
    fs.writeFileSync(target, ['file,scc_size', ...files.map((x) => `${JSON.stringify(x)},${String(sizes.get(x) ?? 1)}`)].join('\n') + '\n');
    process.stdout.write(`${key}\t${String(files.filter((x) => (sizes.get(x) ?? 1) > 1).length)} files on cycles\n`);
  }
}

main().catch((err: unknown) => { process.stderr.write(`${String(err)}\n`); process.exit(2); });
