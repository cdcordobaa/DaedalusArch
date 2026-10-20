/**
 * Gate line V9 on the 2a snapshots (Study 2b readiness gate): the MCP `check_diff` answer against the full evaluation
 * at the freeze tag, Layered only. Entry file: no exports. Zero model calls, no Neo4j. The method is that of
 * `scripts/v1.4/mcp-fast-vs-full-loop.ts` (V9 on the probe and pilot snapshots), applied to the 2a out-roots.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/v9-2a.ts --exploratory <2a shared dir> --node-modules <skeleton node_modules> --work <scratch>
 *     [--rescore results/v1.4-exploratory/stage-c/rescore/snapshots.json] [--dest <dir>]
 *
 * For every 2a snapshot that is not an inherited step 1 (78 of 90), the diff from the step s-1 tree (step 1: the
 * run's skeleton base) to the step s tree is given to `check_diff` (mode after-write, the spec `presets/layered.yaml`,
 * the tools' production default `post-seal-on`), once on the fast path and once with `--fast-rules-engine
 * cypher-interp`. The full evaluation's answer is the blocking findings of step s minus those of step s-1 (multiset
 * on rule, file, target), read from the Stage C re-score at the freeze tag (`freeze.findings`; every blocking row,
 * whatever its check-correct label). The comparison is `compareVariant` of `scripts/v1.3/lib/mcp-consistency.ts`.
 * Writes <dest>/v9-2a.json and <dest>/v9-2a.md.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkDiffTool, createSpecLoader } from '../../src/mcp-server/tools.js';
import type { ServerContext } from '../../src/mcp-server/tools.js';
import { InterpEvaluator } from '../../src/mcp-server/interp-check.js';
import type { FastRulesEngine } from '../../src/mcp-server/interp-check.js';
import { compareVariant, projectDiff } from '../v1.3/lib/mcp-consistency.js';
import type { FullFinding, VariantComparison } from '../v1.3/lib/mcp-consistency.js';

const REPO = process.cwd();
const OUT_ROOTS: Record<string, string[]> = { 'none@L2': ['stage-a', 'r2'], 'none@L3': ['l3'], 'mcp@L2': ['mcp'] };

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : fallback;
  if (v === undefined) throw new Error(`--${name} is required`);
  return v;
}

interface Snap {
  cell: string; task: string; rep: number; runId: string; step: number; commit: string; inheritedStep1: boolean;
  freeze: { findings: { ruleId: string; file: string; target?: string }[] };
}

const fkey = (f: FullFinding): string => `${f.ruleId}|${f.file}|${f.target ?? ''}`;
function delta(next: readonly FullFinding[], prev: readonly FullFinding[]): FullFinding[] {
  const left = new Map<string, number>();
  for (const f of prev) left.set(fkey(f), (left.get(fkey(f)) ?? 0) + 1);
  return next.filter((f) => {
    const n = left.get(fkey(f)) ?? 0;
    if (n > 0) {
      left.set(fkey(f), n - 1);
      return false;
    }
    return true;
  });
}
const toFull = (s: Snap | undefined): FullFinding[] => (s?.freeze.findings ?? []).map((f) => ({ ruleId: f.ruleId, file: f.file, ...(f.target !== undefined && { target: f.target }) }));

function writeCommit(gitDir: string, commit: string, into: string): void {
  const tar = execFileSync('git', ['--git-dir', gitDir, 'archive', commit], { maxBuffer: 256 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', into], { input: tar });
}

function ctx(specPath: string, root: string, engine: FastRulesEngine, interp: InterpEvaluator): ServerContext {
  return {
    ...(engine === 'cypher-interp' && { fastRulesEngine: engine, interp }),
    defaultSpecPath: specPath,
    defaultProjectPath: root,
    env: {},
    loadSpec: createSpecLoader({ postSeal: true }),
    evaluateDeps: {
      makeGraph: () => {
        throw new Error('evaluate_project is not used here');
      },
      makePipeline: () => {
        throw new Error('evaluate_project is not used here');
      },
    },
  };
}

async function main(): Promise<void> {
  const expl = path.resolve(arg('exploratory'));
  const nodeModules = path.resolve(arg('node-modules'));
  const work = path.resolve(arg('work'));
  const dest = path.resolve(arg('dest', 'results/v1.3-study2-gate/pre-run-2026-10-20/V9'));
  const snaps = JSON.parse(fs.readFileSync(path.resolve(arg('rescore', 'results/v1.4-exploratory/stage-c/rescore/snapshots.json')), 'utf8')) as Snap[];
  const spec = path.join(REPO, 'presets', 'layered.yaml');
  const interp = new InterpEvaluator({ tmpDir: path.join(work, 'interp-tmp') });
  fs.mkdirSync(path.join(work, 'interp-tmp'), { recursive: true });
  type Row = VariantComparison & { engine: FastRulesEngine; cell: string; block: string; step: number; error?: string };
  const rows: Row[] = [];
  const key = (s: Pick<Snap, 'cell' | 'runId' | 'step'>): string => `${s.cell}|${s.runId}|${String(s.step)}`;
  const byKey = new Map(snaps.map((s) => [key(s), s]));
  for (const s of snaps.filter((x) => !x.inheritedStep1)) {
    const root = (OUT_ROOTS[s.cell] ?? []).map((r) => path.join(expl, r)).find((r) => fs.existsSync(path.join(r, 'runs', s.runId, 'snapshots.git')));
    if (root === undefined) throw new Error(`no out-root for ${s.cell} ${s.runId}`);
    const gitDir = path.join(root, 'runs', s.runId, 'snapshots.git');
    const prevSnap = s.step === 1 ? undefined : byKey.get(key({ ...s, step: s.step - 1 }));
    if (s.step > 1 && prevSnap === undefined) throw new Error(`missing step ${String(s.step - 1)} of ${s.cell} ${s.runId}`);
    const prevCommit = s.step === 1
      ? execFileSync('git', ['--git-dir', gitDir, 'log', '--format=%H %s', '--reverse', '--all']).toString('utf8').split('\n').find((l) => l.includes('base: skeleton'))?.split(' ')[0]
      : prevSnap?.commit;
    if (prevCommit === undefined) throw new Error(`no base commit for ${s.cell} ${s.runId}`);
    const dir = path.join(work, 'v9-2a');
    const prev = path.join(dir, 'prev');
    const cur = path.join(dir, 'cur');
    for (const d of [prev, cur]) {
      fs.rmSync(d, { recursive: true, force: true });
      fs.mkdirSync(d, { recursive: true });
    }
    writeCommit(gitDir, prevCommit, prev);
    writeCommit(gitDir, s.commit, cur);
    for (const d of [prev, cur]) fs.symlinkSync(nodeModules, path.join(d, 'node_modules'));
    const diff = projectDiff(prev, cur);
    const full = delta(toFull(s), toFull(prevSnap));
    for (const engine of ['fast', 'cypher-interp'] as FastRulesEngine[]) {
      const meta = { style: 'layered', variant: `${s.cell}/${s.task}/rep${String(s.rep)}/step-${String(s.step)}`, kind: 'agent-step', plants: null, mode: 'after-write' as const };
      const t0 = performance.now();
      const res = await checkDiffTool(ctx(spec, cur, engine, interp), { diff });
      const ms = performance.now() - t0;
      const tag = { engine, cell: s.cell, block: `${s.task}/rep${String(s.rep)}`, step: s.step };
      if (!res.ok) {
        rows.push({ ...compareVariant(meta, full, { verdict: 'clean', summary: '', files: [], skipped: [], blockingVerdict: 'pass', blockingCount: 0, advisoryCount: 0, blockingSummary: '' }, ms), ...tag, error: res.message });
        continue;
      }
      rows.push({ ...compareVariant(meta, full, res.data, ms), ...tag });
    }
  }
  const summary = (['fast', 'cypher-interp'] as FastRulesEngine[]).map((engine) => {
    const rs = rows.filter((r) => r.engine === engine);
    return {
      engine, steps: rs.length,
      fullBlocks: rs.filter((r) => r.full.blocks).length,
      answerAgree: rs.filter((r) => r.answerAgrees).length,
      rulesAgree: rs.filter((r) => r.rulesAgree).length,
      locationsAgree: rs.filter((r) => r.locationsAgree).length,
      fullOnly: rs.filter((r) => r.fullOnlyRules.length > 0).length,
      toolOnly: rs.filter((r) => r.toolOnlyRules.length > 0).length,
      errors: rs.filter((r) => r.error !== undefined).length,
    };
  });
  fs.mkdirSync(dest, { recursive: true });
  const scrub = (v: string): string => v.split(work).join('<work>').split(expl).join('<shared>/daedalus-exploratory').split(REPO).join('.');
  fs.writeFileSync(path.join(dest, 'v9-2a.json'), `${scrub(JSON.stringify({ spec: 'presets/layered.yaml', config: 'post-seal-on', summary, rows: rows.map((r) => ({ ...r, tool: { ...r.tool, ms: Math.round(r.tool.ms) } })) }, null, 1))}\n`);
  const f = (xs: readonly FullFinding[]): string => xs.map((x) => `${x.ruleId} ${x.file}${x.target !== undefined ? ` → ${x.target}` : ''}`).join('; ') || '-';
  const md = [
    '# V9 on the 2a snapshots: MCP `check_diff` vs the full evaluation at the freeze tag', '',
    'Generated by `scripts/v1.4/v9-2a.ts` (zero calls). One row per step diff (step s-1 → s; step 1 from the skeleton base), mode after-write, spec `presets/layered.yaml`, post-seal on. Inherited shared-start step-1 records are skipped (they are the `none@L2` step-1 trees).', '',
    '| Engine | Step diffs | Full blocks | Answer agrees | Rules agree | Locations agree | Full only | Tool only | Errors |',
    '|---|---|---|---|---|---|---|---|---|',
    ...summary.map((s) => `| ${s.engine} | ${String(s.steps)} | ${String(s.fullBlocks)} | ${String(s.answerAgree)}/${String(s.steps)} | ${String(s.rulesAgree)}/${String(s.steps)} | ${String(s.locationsAgree)}/${String(s.steps)} | ${String(s.fullOnly)} | ${String(s.toolOnly)} | ${String(s.errors)} |`),
    '', '## Disagreements', '',
    '| Engine | Cell | Block | Step | Full blocking (delta) | Tool blocking |', '|---|---|---|---|---|---|',
    ...rows.filter((r) => !r.rulesAgree || !r.answerAgrees || !r.locationsAgree).map((r) => `| ${r.engine} | ${r.cell} | ${r.block} | ${String(r.step)} | ${f(r.full.findings)} | ${f(r.tool.findings)}${r.error !== undefined ? ` (error: ${r.error})` : ''} |`),
    '',
  ];
  fs.writeFileSync(path.join(dest, 'v9-2a.md'), `${scrub(md.join('\n'))}\n`);
  for (const s of summary) process.stdout.write(`${JSON.stringify(s)}\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
