/**
 * D_sem provenance classifier and D_sem writer (Study 2b pre-registration §4, "Semantic layer": D_sem two ways and the
 * evasion candidates; sem-01 T1, §6 and §8 item 1; pre-registration addendum 1, DA8). Entry file: no exports. Helpers:
 * `scripts/v1.4/lib/dsem-provenance.ts`. Zero model calls, no Neo4j, no network: authorship comes from `git blame` on
 * each run's `snapshots.git`. Additive: it changes no frozen path.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/dsem-provenance.ts --c4 <dir> --rescore <dir> --cell <cell>=<out-root> [--cell ...] --out <dir>
 *     [--external-non-agent <path or prefix> ...]   non-agent texts that are not in the tree (task spec, step request,
 *                                                    preset) when the C4 configuration gives them to C4 as docs
 *     [--family H1,H2,H3] [--seed 20261021] [--draws 99999] [--resamples 10000]
 *
 * Reads: `<c4>/<slug>/interpretations.json` (the C4 A5 files; slug `none-L2__<task>__rep<r>__step-<NN>`, as
 * `c4-run.ts` and `semantic-sample.ts` write them), `<rescore>/snapshots.json` (the snapshot commit of each slug),
 * `<rescore>/analysis.json` (`countedIdentities`: the D identities with their first step), `<rescore>/runs.json` (the
 * blocks and D, for the registered contrast readings), and the out-roots' `run.json`, `steps/step-NN.json` and
 * `snapshots.git` (read-only).
 * Writes `<out>/dsem-all.json` and `<out>/dsem-nonagent.json` (rows `{cell, block, D, evasionCandidates}` for
 * `study2b-analyse.ts --dsem` and `--dsem-nonagent`), `<out>/provenance.json` (every claim and cited line, per block,
 * per cell, the readings, the input hashes) and `<out>/summary.md`. Out-root paths are written as `<out-root:cell>`.
 *
 * The registered readings: per cell, sem-01 P3 (D_sem over non-agent claims equals D; a gap between D and D_sem over
 * all claims is an evasion signal); per contrast, `semanticReading` (D against D_sem over all claims) and
 * `agentJustificationReading` (the two D_sem versions), from the registered analysis helpers, when every block has
 * both D_sem values. Otherwise the contrast readings are "not computed" and the reason is printed.
 * Exit 0 ok, 1 an input is inconsistent, 2 usage error.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ANALYSIS_SEED, BOOT_RESAMPLES, CELLS, CONTRASTS, MC_DRAWS, agentJustificationReading, analyseContrast, familyDecision,
  isComplete, semanticReading, type Block, type Cell, type HypothesisId,
} from './lib/study2b-analyse.js';
import {
  DSEM_PROVENANCE_VERSION, analyseRows, blockDsem, cellDsem, classifyEntries, parseSlug, stepMapOfRun,
  type A5Entry, type BlockDsem, type ClaimRow, type CountedIdentity, type StepMap,
} from './lib/dsem-provenance.js';

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const args = (name: string): string[] => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] !== undefined ? [argv[i + 1] ?? ''] : []));
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const sha = (p: string): string => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

interface SnapRow { cell: string; task: string; rep: number; runId: string; step: number; commit: string }
interface RunRow { cell: string; task: string; rep: number; block: string; registered: { D: number | null; Y1: number | null; Yk: number | null; incomplete?: boolean } }

function runDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!e.isDirectory() || ['snapshots.git', 'work', 'turns', 'steps', 'calls', 'node_modules', 'home'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (fs.existsSync(path.join(p, 'run.json'))) out.push(p);
    else out.push(...runDirs(p));
  }
  return out;
}

function main(): number {
  const c4 = arg('c4');
  const rescore = arg('rescore');
  const outDir = arg('out');
  const cells = args('cell').map((c) => {
    const i = c.indexOf('=');
    if (i <= 0) throw new Error(`--cell ${c}: expected <cell>=<out-root>`);
    return { cell: c.slice(0, i), root: path.resolve(c.slice(i + 1)) };
  });
  if (c4 === undefined || rescore === undefined || outDir === undefined || cells.length === 0) {
    process.stderr.write('usage: dsem-provenance.ts --c4 <dir> --rescore <dir> --cell <cell>=<out-root> ... --out <dir> [options; see the header]\n');
    return 2;
  }
  const external = args('external-non-agent');
  const family = (arg('family') ?? 'H1,H2,H3').split(',') as HypothesisId[];
  const opts = { seed: Number(arg('seed') ?? String(ANALYSIS_SEED)), draws: Number(arg('draws') ?? String(MC_DRAWS)), resamples: Number(arg('resamples') ?? String(BOOT_RESAMPLES)) };
  const scrub = (s: string): string => cells.reduce((acc, c) => acc.split(c.root).join(`<out-root:${c.cell}>`), s);

  const snapFile = path.join(rescore, 'snapshots.json');
  const analysisFile = path.join(rescore, 'analysis.json');
  const runsFile = path.join(rescore, 'runs.json');
  const snaps = readJson<SnapRow[]>(snapFile);
  const counted = readJson<{ countedIdentities: CountedIdentity[] }>(analysisFile).countedIdentities;
  const runs = readJson<RunRow[]>(runsFile);
  const inputs: Record<string, string> = {
    'snapshots.json': sha(snapFile), 'analysis.json': sha(analysisFile), 'runs.json': sha(runsFile),
    // Run from the repository root (usage above), so the classifier's own files are read relative to it.
    'scripts/v1.4/dsem-provenance.ts': sha('scripts/v1.4/dsem-provenance.ts'), 'scripts/v1.4/lib/dsem-provenance.ts': sha('scripts/v1.4/lib/dsem-provenance.ts'),
  };

  // Step maps of every run of every out-root, found by the snapshot commit.
  const maps: { cell: string; m: StepMap }[] = cells.flatMap(({ cell, root }) => runDirs(path.join(root, 'runs')).map((d) => ({ cell, m: stepMapOfRun(d) })));
  const mapOf = (cell: string, commit: string): StepMap | undefined => maps.find((x) => x.cell === cell && x.m.stepOf.has(commit))?.m;

  const slugs = fs.existsSync(c4) ? fs.readdirSync(c4).filter((s) => fs.existsSync(path.join(c4, s, 'interpretations.json'))).sort() : [];
  const perSnapshot: { slug: string; cell: string; block: string; step: number; commit: string; entries: A5Entry[]; rows: ClaimRow[] }[] = [];
  let bad = 0;
  for (const slug of slugs) {
    const p = parseSlug(slug);
    if (p === null) { process.stderr.write(`${slug}: not a C4 snapshot slug\n`); bad++; continue; }
    const snap = snaps.filter((s) => s.cell === p.cell && s.task === p.task && s.rep === p.rep && s.step === p.step).at(-1);
    if (snap === undefined) { process.stderr.write(`${slug}: no snapshot row in ${snapFile}\n`); bad++; continue; }
    const m = mapOf(p.cell, snap.commit);
    if (m === undefined) { process.stderr.write(`${slug}: commit ${snap.commit.slice(0, 12)} is in no run of the ${p.cell} out-roots\n`); bad++; continue; }
    const entries = readJson<{ entries: A5Entry[] }>(path.join(c4, slug, 'interpretations.json')).entries;
    const ids = counted.filter((c) => c.cell === p.cell && c.block === p.block);
    const rows = classifyEntries(entries, m, snap.commit, p.step, ids, { externalNonAgent: external });
    perSnapshot.push({ slug, cell: p.cell, block: p.block, step: p.step, commit: snap.commit, entries, rows });
  }
  if (bad > 0) return 1;

  // D_sem per block: every block of runs.json; C4 output pooled over the block's snapshots.
  const blocks: BlockDsem[] = runs.map((r) => {
    const ids = counted.filter((c) => c.cell === r.cell && c.block === r.block);
    const snapsOf = perSnapshot.filter((s) => s.cell === r.cell && s.block === r.block);
    const b = blockDsem(r.cell, r.block, ids, snapsOf.length === 0 ? null : snapsOf.flatMap((s) => s.entries), snapsOf.length === 0 ? null : snapsOf.flatMap((s) => s.rows));
    if (r.registered.D !== null && r.registered.D !== b.D) process.stderr.write(`warning: ${r.cell} ${r.block}: runs.json D ${String(r.registered.D)} but ${String(b.D)} counted identities\n`);
    return b;
  });
  const cellNames = [...new Set(runs.map((r) => r.cell))];
  const perCell = cellNames.map((c) => cellDsem(c, blocks));

  // The registered contrast readings, only when every complete block has both D_sem values.
  const isCell = (c: string): c is Cell => (CELLS as readonly string[]).includes(c);
  const blockIds = [...new Set(runs.map((r) => r.block))].sort();
  const pb: Block[] = blockIds.map((id) => {
    const rs = runs.filter((r) => r.block === id && isCell(r.cell));
    const at = (c: Cell): RunRow | undefined => rs.find((r) => r.cell === c);
    const D = Object.fromEntries(CELLS.map((c) => { const r = at(c); return [c, r === undefined || r.registered.incomplete === true ? null : r.registered.D]; })) as Record<Cell, number | null>;
    const Yk = Object.fromEntries(CELLS.map((c) => [c, at(c)?.registered.Yk ?? null])) as Record<Cell, number | null>;
    const first = rs[0];
    return { block: id, task: first?.task ?? '', rep: first?.rep ?? 0, Y1: at('none@L2')?.registered.Y1 ?? first?.registered.Y1 ?? null, D, Yk };
  }).filter(isComplete);
  const semOf = (b: Block, cell: Cell, v: 'all' | 'na'): number | null => {
    const x = blocks.find((y) => y.cell === cell && y.block === b.block);
    return x === undefined ? null : v === 'all' ? x.dsemAll : x.dsemNonAgent;
  };
  const missing = pb.flatMap((b) => CELLS.filter((c) => semOf(b, c, 'all') === null).map((c) => `${c} ${b.block}`));
  let readings: Record<string, unknown>;
  if (pb.length === 0) readings = { computed: false, reason: 'no complete block in runs.json' };
  else if (missing.length > 0) readings = { computed: false, reason: `${String(missing.length)} cell-blocks with D > 0 have no C4 output: ${missing.join(', ')}` };
  else {
    const dec = (value?: (b: Block, c: Cell) => number | null): ReturnType<typeof familyDecision> => familyDecision(CONTRASTS.map((c) => analyseContrast(pb, c, { ...opts, ...(value !== undefined ? { value } : {}) })), family);
    const dD = dec();
    const dAll = dec((b, c) => semOf(b, c, 'all'));
    const dNa = dec((b, c) => semOf(b, c, 'na'));
    readings = { computed: true, blocks: pb.length, decisions: { D: dD.decisions, dsemAll: dAll.decisions, dsemNonAgent: dNa.decisions }, semantic: semanticReading(dD, dAll), agentJustification: agentJustificationReading(dAll, dNa) };
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'dsem-all.json'), `${JSON.stringify(analyseRows(blocks, 'all'), null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'dsem-nonagent.json'), `${JSON.stringify(analyseRows(blocks, 'non-agent'), null, 2)}\n`);
  const claims = perSnapshot.flatMap((s) => s.rows.map((r) => ({ slug: s.slug, cell: s.cell, block: s.block, snapshotStep: s.step, snapshotCommit: s.commit, ...r })));
  const provenance = { version: DSEM_PROVENANCE_VERSION, modelCalls: 0, inputs, externalNonAgent: external, snapshots: perSnapshot.map((s) => ({ slug: s.slug, cell: s.cell, block: s.block, step: s.step, commit: s.commit, entries: s.entries.length })), claims, blocks, cells: perCell, readings };
  fs.writeFileSync(path.join(outDir, 'provenance.json'), `${scrub(JSON.stringify(provenance, null, 2))}\n`);

  const md = [
    '# D_sem provenance (zero model calls)', '',
    `Classifier ${DSEM_PROVENANCE_VERSION}; \`scripts/v1.4/dsem-provenance.ts\` sha256 \`${inputs['scripts/v1.4/dsem-provenance.ts'] ?? ''}\`, lib sha256 \`${inputs['scripts/v1.4/lib/dsem-provenance.ts'] ?? ''}\`.`,
    `C4 snapshots read: ${String(perSnapshot.length)}; interpreted findings: ${String(claims.length)}; stable grounded claims: ${String(claims.filter((c) => c.stable).length)}.`, '',
    '| Cell | Blocks (C4 output / D_sem not run) | D, every block | D, where D_sem exists | D_sem (all claims) | D_sem (non-agent claims) | Evasion candidates | Registered reading (sem-01 P3) |',
    '|---|---|---|---|---|---|---|---|',
    ...perCell.map((c) => `| ${c.cell} | ${String(c.blocks)} (${String(c.coveredBlocks)} / ${String(c.notRunBlocks)}) | ${String(c.dEveryBlock)} | ${String(c.D)} | ${String(c.dsemAll)} | ${String(c.dsemNonAgent)} | ${String(c.evasionCandidates)} | ${c.reading.text} |`),
    '',
    readings.computed === true
      ? `Contrast readings over ${String(readings.blocks)} blocks: ${Object.entries(readings.semantic as Record<string, { reading: string }>).map(([k, v]) => `${k} ${v.reading}`).join('; ')}. Two D_sem versions: ${Object.entries(readings.agentJustification as Record<string, { reading: string }>).map(([k, v]) => `${k} ${v.reading}`).join('; ')}.`
      : `Contrast readings: not computed (${String(readings.reason)}).`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'summary.md'), scrub(md));
  process.stdout.write(scrub(md));
  return 0;
}

process.exitCode = main();
