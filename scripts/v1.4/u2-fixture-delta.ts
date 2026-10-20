/**
 * U2 fixture delta (v1.4, design `aidlc-docs/construction/v1.4/U2/functional-design/design.md` §6 test 5): the
 * findings of every committed fixture/spec pair that a test asserts on, before and after the two post-seal rules
 * (FF-S02 in ddd, D5; FF-P07 application-purity, N3), listed exactly.
 *
 *   npx tsx scripts/v1.4/u2-fixture-delta.ts --write-baseline results/v1.4-u2/baseline.json   # on the unchanged tree
 *   npx tsx scripts/v1.4/u2-fixture-delta.ts --baseline results/v1.4-u2/baseline.json --out results/v1.4-u2
 *
 * Every run is the real pipeline (`createPipeline`) with `graphEngine: 'cypher-interp'` and
 * `evaluationMode: 'symbolic-only'` (no LLM provider is built), in the scoring mode the fixture's own test uses. No
 * Neo4j connection, no network, no model call. The pairs run one after another in one process.
 *
 * `--write-baseline` runs each pair once with today's options and also stores the compile output of the five presets
 * under today's `V13_COMPILE_OPTIONS` (read by `tests/unit/post-seal/post-seal-rules.test.ts`). The delta run runs each
 * pair with the post-seal rules off and on: the off rows must equal the baseline (the sealed rule set is reproduced),
 * and the on rows minus the baseline are the delta. The MCP default-path capture
 * (`tests/unit/mcp-server/interp-parity-capture.ts`) is compared with the baseline as a whole.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../src/pipeline/types.js';
import { parseInstrumentVersion } from '../../src/fitness-compiler/role-exemptions.js';
import { STATUS_QUO_ANSWERS } from '../../src/shared/construct-switches.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../src/fitness-compiler/index.js';
import { compilerInputFromSpec } from '../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../src/spec-parser/spec-parser.js';
import { canonicalize } from '../lib/canonical-json.js';
import { cycleFileSet, CYCLE_RULE_IDS, normaliseFindingPath } from '../v1.3/lib/compare.js';
import { materialiseVariant } from '../v1.3/lib/materialise.js';
import { loadAllReferences } from '../v1.3/lib/reference-model.js';

export const REPO_ROOT = typeof __dirname === 'string' ? path.resolve(__dirname, '../..') : process.cwd();

export type ScoringMode = 'v1.2e' | 'v1.3';

/** One committed fixture/spec pair. `project` is materialised by `prepare` when the fixture is a reference variant. */
export interface Pair {
  readonly id: string;
  readonly group: 'golden' | 'v1.3-reference' | 'hexagonal' | 'antipattern-nest' | 'ap-hosts';
  readonly spec: string;
  readonly scoringMode: ScoringMode;
  /** Repository-relative project directory, or a reference variant to materialise. */
  readonly project: string | { readonly style: string; readonly variant: string };
}

/** One normalised finding row. */
export interface Row {
  readonly rule: string;
  readonly file: string;
  readonly target: string;
  readonly tier: string | null;
}

export interface PairResult {
  readonly id: string;
  readonly rows: readonly Row[];
  readonly verdict: string | null;
}

export const PRESETS = ['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd'] as const;

const GOLDEN_IDS = ['correct-reference', 'variant-a-structural', 'variant-b-pattern', 'variant-c-everything', 'variant-d-subtle'];
const AP_HOSTS = ['blood-drives', 'coworking-memberships', 'museum-loans', 'translation-jobs'];

/** The fixed, committed pair list (design §6 test 5). */
export function allPairs(repoRoot: string = REPO_ROOT): Pair[] {
  const pairs: Pair[] = GOLDEN_IDS.map((id) => ({ id: `golden/${id}`, group: 'golden', spec: 'specs/clean-arch.yaml', scoringMode: 'v1.2e', project: `fixtures/${id}` }));
  for (const ref of loadAllReferences(repoRoot)) {
    const spec = path.relative(repoRoot, ref.specPath).split(path.sep).join('/');
    for (const v of ref.variants) {
      pairs.push({ id: `v1.3-reference/${ref.style}/${v.manifest.variant}`, group: 'v1.3-reference', spec, scoringMode: 'v1.3', project: { style: ref.style, variant: v.manifest.variant } });
    }
  }
  for (const v of ['clean', 'violating']) {
    pairs.push({ id: `hexagonal/${v}`, group: 'hexagonal', spec: 'presets/hexagonal.yaml', scoringMode: 'v1.3', project: `tests/fixtures/hexagonal/${v}` });
  }
  pairs.push({ id: 'antipattern-nest', group: 'antipattern-nest', spec: 'fixtures/unit/antipattern-nest/firewall.spec.yaml', scoringMode: 'v1.3', project: 'fixtures/unit/antipattern-nest' });
  for (const h of AP_HOSTS) {
    pairs.push({ id: `ap-hosts/${h}`, group: 'ap-hosts', spec: `fixtures/unit/ap-hosts/${h}/firewall.spec.yaml`, scoringMode: 'v1.3', project: `fixtures/unit/ap-hosts/${h}` });
  }
  return pairs;
}

/** The light subset the jest test re-runs in process (design plan step 9.7): the golden 5 and the reference ddd and clean variants. */
export function lightPairs(repoRoot: string = REPO_ROOT): Pair[] {
  return allPairs(repoRoot).filter((p) => p.group === 'golden' || p.id === 'v1.3-reference/ddd/clean' || p.id === 'v1.3-reference/ddd/v09-domain-imports-application'
    || p.id === 'v1.3-reference/clean-architecture/clean');
}

function projectDirOf(pair: Pair, repoRoot: string, scratch: string): string {
  if (typeof pair.project === 'string') return path.join(repoRoot, pair.project);
  const { style, variant } = pair.project;
  const ref = loadAllReferences(repoRoot).find((r) => r.style === style);
  const v = ref?.variants.find((x) => x.manifest.variant === variant);
  if (ref === undefined || v === undefined) throw new Error(`no reference variant ${style}/${variant}`);
  return materialiseVariant(ref, v, scratch).projectDir;
}

function normalise(raw: string, projectDir: string): string {
  return raw.split(',').map((p) => normaliseFindingPath(p.trim(), projectDir)).join(',');
}

function sortRows(rows: Row[]): Row[] {
  const k = (r: Row): string => `${r.rule}|${r.file}|${r.target}|${r.tier ?? ''}`;
  return rows.sort((a, b) => (k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0));
}

/**
 * Runs one pair through the pipeline. `postSeal` undefined passes no option (the baseline run, which must also work on
 * the tree before U2); true or false sets `PipelineConfig.postSealRules`.
 */
export async function runPair(pair: Pair, postSeal: boolean | undefined, repoRoot: string = REPO_ROOT): Promise<PairResult> {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u2-delta-'));
  try {
    const projectDir = projectDirOf(pair, repoRoot, scratch);
    const config: PipelineConfig & { postSealRules?: boolean } = {
      projectPath: projectDir, specFilePath: path.join(repoRoot, pair.spec), neo4jUri: '', neo4jUser: '', neo4jPassword: '',
      evaluationMode: 'symbolic-only', pipelineMode: 'stateless', persist: false, diff: false, verbose: false,
      apgStorePath: path.join(scratch, '.apg'), instrumentVersion: parseInstrumentVersion('v2'), scoringMode: pair.scoringMode,
      graphEngine: 'cypher-interp',
      // The U2 delta is measured at the construct status quo, as its committed baseline was; the applied answers
      // (ADR-V13-03 draft) would move rows that are not the post-seal rules' delta.
      constructAnswers: STATUS_QUO_ANSWERS,
      ...(postSeal !== undefined ? { postSealRules: postSeal } : {}),
    };
    const { executor, cleanup } = createPipeline(config);
    try {
      const r = await executor.execute();
      if (!r.success) throw new Error(`${pair.id}: ${r.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}`);
      const report = r.data;
      const tierOf = new Map<string, string>();
      for (const row of [...(report.tiers?.blocking.rules ?? []), ...(report.tiers?.advisory.rules ?? [])]) {
        if (!tierOf.has(String(row.functionId))) tierOf.set(String(row.functionId), row.tier);
      }
      const rows: Row[] = report.violations.map((v) => {
        const rule = String(v.functionId);
        const file = normalise(v.filePath, projectDir);
        const target = typeof v.target === 'string' ? normalise(v.target, projectDir) : '';
        const cyc = CYCLE_RULE_IDS.has(rule);
        return { rule, file: cyc ? cycleFileSet({ file, target }) : file, target: cyc ? '' : target, tier: report.tiers !== undefined ? tierOf.get(rule) ?? null : null };
      });
      return { id: pair.id, rows: sortRows(rows), verdict: report.tiers?.verdict ?? null };
    } finally {
      await cleanup();
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/** The five presets compiled with `V13_COMPILE_OPTIONS` as it is when this runs (instrument v2), as canonical JSON values. */
export async function presetCompiles(repoRoot: string = REPO_ROOT, extra: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const p of PRESETS) {
    const parsed = await parseSpec({ specFilePath: path.join(repoRoot, 'presets', `${p}.yaml`) });
    if (!parsed.success) throw new Error(`preset ${p}: ${JSON.stringify(parsed.errors)}`);
    const instrumentVersion = parseInstrumentVersion('v2');
    if (instrumentVersion === undefined) throw new Error('instrument v2 unknown');
    const c = compileFunctions(compilerInputFromSpec(parsed.data), { ...V13_COMPILE_OPTIONS, instrumentVersion, ...extra });
    if (!c.success) throw new Error(`preset ${p}: ${c.errors.map((e) => e.message).join('; ')}`);
    out[p] = JSON.parse(JSON.stringify(c.data)) as unknown;
  }
  return out;
}

async function mcpCapture(): Promise<unknown> {
  const { captureTools } = await import('../../tests/unit/mcp-server/interp-parity-capture.js');
  return captureTools([], {});
}

export interface Baseline {
  readonly note: string;
  readonly pairs: readonly PairResult[];
  readonly presets: Record<string, unknown>;
  readonly mcp: unknown;
}

export interface DeltaRow extends Row { readonly pair: string; readonly change: 'added' | 'removed' }

export interface Delta {
  readonly note: string;
  readonly pairs: number;
  readonly offEqualsBaseline: boolean;
  readonly offMismatches: readonly string[];
  readonly rows: readonly DeltaRow[];
  readonly verdictChanges: readonly { pair: string; before: string | null; after: string | null }[];
  readonly mcpChanged: boolean;
}

const rowKey = (r: Row): string => `${r.rule}|${r.file}|${r.target}|${r.tier ?? ''}`;

/** Multiset difference of two row lists, as added and removed rows. */
export function diffRows(pair: string, before: readonly Row[], after: readonly Row[]): DeltaRow[] {
  const count = new Map<string, number>();
  for (const r of before) count.set(rowKey(r), (count.get(rowKey(r)) ?? 0) + 1);
  const added: DeltaRow[] = [];
  for (const r of after) {
    const n = count.get(rowKey(r)) ?? 0;
    if (n > 0) count.set(rowKey(r), n - 1); else added.push({ pair, change: 'added', ...r });
  }
  const removed: DeltaRow[] = [];
  const left = new Map(count);
  for (const r of before) {
    const n = left.get(rowKey(r)) ?? 0;
    if (n > 0) { removed.push({ pair, change: 'removed', ...r }); left.set(rowKey(r), n - 1); }
  }
  return [...added, ...removed];
}

/** The delta of `pairs` against the baseline (the off run must reproduce the baseline rows). */
export async function computeDelta(baseline: Baseline, pairs: readonly Pair[], withMcp: boolean, repoRoot: string = REPO_ROOT): Promise<Delta> {
  const byId = new Map(baseline.pairs.map((p) => [p.id, p]));
  const rows: DeltaRow[] = [];
  const offMismatches: string[] = [];
  const verdictChanges: { pair: string; before: string | null; after: string | null }[] = [];
  for (const pair of pairs) {
    const base = byId.get(pair.id);
    if (base === undefined) throw new Error(`${pair.id}: not in the baseline`);
    const off = await runPair(pair, false, repoRoot);
    if (canonicalize(off.rows) !== canonicalize(base.rows) || off.verdict !== base.verdict) offMismatches.push(pair.id);
    const on = await runPair(pair, true, repoRoot);
    rows.push(...diffRows(pair.id, base.rows, on.rows));
    if (on.verdict !== base.verdict) verdictChanges.push({ pair: pair.id, before: base.verdict, after: on.verdict });
  }
  const mcpChanged = withMcp ? canonicalize(await mcpCapture()) !== canonicalize(baseline.mcp) : false;
  return {
    note: 'U2 fixture delta: rows added or removed by the post-seal rules (on) against the pre-U2 baseline; the off run must equal the baseline.',
    pairs: pairs.length, offEqualsBaseline: offMismatches.length === 0, offMismatches, rows, verdictChanges, mcpChanged,
  };
}

/** The delta as the Markdown table the ADRs copy verbatim. */
export function deltaTable(rows: readonly DeltaRow[]): string {
  const lines = ['| Pair | Change | Rule | File | Target | Tier |', '|---|---|---|---|---|---|'];
  for (const r of rows) lines.push(`| ${r.pair} | ${r.change} | ${r.rule} | ${r.file.split(',').join(', ')} | ${r.target === '' ? '-' : r.target} | ${r.tier ?? '-'} |`);
  return lines.join('\n');
}

function deltaMarkdown(d: Delta): string {
  return [
    '# U2 fixture delta (post-seal rules off vs on)',
    '',
    `Generated by \`npx tsx scripts/v1.4/u2-fixture-delta.ts\` (cypher-interp, symbolic-only; no Neo4j, no model). ${String(d.pairs)} fixture/spec pairs.`,
    '',
    `- Post-seal off reproduces the pre-U2 baseline: ${d.offEqualsBaseline ? 'yes, every pair' : `NO: ${d.offMismatches.join(', ')}`}.`,
    `- MCP default-path capture changed: ${d.mcpChanged ? 'yes' : 'no'}.`,
    `- Rows added: ${String(d.rows.filter((r) => r.change === 'added').length)}; rows removed: ${String(d.rows.filter((r) => r.change === 'removed').length)}.`,
    '',
    '## Rows',
    '',
    deltaTable(d.rows),
    '',
    '## Verdict changes (v1.3 tiered verdict)',
    '',
    ...(d.verdictChanges.length === 0 ? ['None.'] : ['| Pair | Before | After |', '|---|---|---|', ...d.verdictChanges.map((v) => `| ${v.pair} | ${v.before ?? '-'} | ${v.after ?? '-'} |`)]),
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const opt = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const writeBaseline = opt('--write-baseline');
  if (writeBaseline !== undefined) {
    const pairs: PairResult[] = [];
    for (const pair of allPairs()) {
      pairs.push(await runPair(pair, undefined));
      process.stderr.write(`baseline ${pair.id}\n`);
    }
    const baseline: Baseline = {
      note: 'U2 pre-change baseline: findings of every pair and the five presets compiled with V13_COMPILE_OPTIONS (instrument v2), written on the tree before U2.',
      pairs, presets: await presetCompiles(), mcp: await mcpCapture(),
    };
    fs.mkdirSync(path.dirname(path.resolve(writeBaseline)), { recursive: true });
    fs.writeFileSync(path.resolve(writeBaseline), `${JSON.stringify(baseline, null, 2)}\n`);
    return;
  }
  const baselinePath = opt('--baseline');
  const out = opt('--out');
  if (baselinePath === undefined || out === undefined) throw new Error('usage: --write-baseline <file> | --baseline <file> --out <dir>');
  const baseline = JSON.parse(fs.readFileSync(path.resolve(baselinePath), 'utf8')) as Baseline;
  const delta = await computeDelta(baseline, allPairs(), true);
  fs.mkdirSync(path.resolve(out), { recursive: true });
  fs.writeFileSync(path.join(path.resolve(out), 'fixture-delta.json'), `${JSON.stringify(delta, null, 2)}\n`);
  fs.writeFileSync(path.join(path.resolve(out), 'fixture-delta.md'), deltaMarkdown(delta));
  process.stdout.write(`${deltaMarkdown(delta)}\n`);
}

const isMain = typeof require !== 'undefined' ? require.main === module : process.argv[1]?.endsWith('u2-fixture-delta.ts') === true;
if (isMain) {
  main().catch((e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
    process.exit(1);
  });
}
