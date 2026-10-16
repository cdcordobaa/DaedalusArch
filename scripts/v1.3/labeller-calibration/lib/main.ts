/**
 * v1.3 labeller calibration: the command line (Docs/v1.3/labeller-calibration-plan.md §8 lists the exact commands).
 *
 *   fetch   --data <dir>                                   download the pinned dataset files, verify md5
 *   sample  --data <dir> [--dataset <id>] [--offline]       draw the seeded sample, resolve code, write
 *                                                          <results>/<dataset>/sample.json and prompts.json (hashes)
 *   dry-run --data <dir> [--dataset <id>] [--rater <r>] [--arm <a>] [--print all|<n>|none] [--fake]
 *                                                          print the exact prompts and the call count; no model call
 *   record  --data <dir> --dataset <id> --rater claude|gemini --arm judge|labeller --budget <n> --tmp-root <dir>
 *           [--claude-config-dir <dir>] [--agy-home <dir>] [--agy-accept-version <v>]
 *                                                          real calls through the cassette (resumable)
 *   score   [--fake-dir <dir>]                             agreement statistics and the decision rule → report
 *
 * `record` and the `--fake` dry run check the sample's code hashes and every prompt hash against the committed
 * `prompts.json` before the first call: a prompt that differs from the pre-registered one is refused.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { parseDacos, readZipEntries } from './dacos.js';
import { mapMlcq, parseMlcq } from './datasets.js';
import type { MlcqMapping } from './datasets.js';
import { codeResolver, fetchSource, nodeFetcher, sha256 } from './fetch.js';
import type { DatasetSource, Fetcher } from './fetch.js';
import { callsFor, runsFor } from './prompts.js';
import { BudgetExhaustedError, Cassette, CLAUDE_MODEL, GEMINI_MODEL, cassetteKey, CassetteMissError, DRY_RUN_FAKES, RaterError, claudeRater, fakeRater, geminiRater } from './raters.js';
import type { Rater } from './raters.js';
import { callEstimate, labelSample } from './run.js';
import { resolveSample } from './sample.js';
import type { SampleDesign } from './sample.js';
import { consensus, renderScores, scoreDataset, DECISION_RULE } from './score.js';
import { tasksSha256 } from './tasks.js';
import { ARMS, DATASET_IDS } from './types.js';
import type { Arm, CalibrationItem, DatasetId, RaterId, RaterLabel, ResolvedItem } from './types.js';

export const RESULTS_DIR = 'results/v1.3-labeller-calibration';
export const SOURCES_FILE = 'scripts/v1.3/labeller-calibration/sources.json';
export const SEED = 20261016;

/** The pre-registered sample designs (plan §3). */
export const DESIGNS: Readonly<Record<DatasetId, SampleDesign>> = Object.freeze({
  mlcq: { dataset: 'mlcq', seed: SEED, minRatings: 3, perStratum: 32, tasks: ['blob', 'data-class', 'long-method'] },
  dacos: { dataset: 'dacos', seed: SEED, minRatings: 2, perStratum: 48, tasks: ['multifaceted-abstraction', 'complex-method'] },
});

export const REAL_RATERS: readonly RaterId[] = ['claude', 'gemini'];

export interface Io {
  readonly out: (t: string) => void;
  readonly err: (t: string) => void;
  readonly repoRoot: string;
  readonly fetcher?: Fetcher;
  /** Test seam: builds a real rater (defaults to the CLI routes). */
  readonly makeRater?: (id: RaterId, args: ReadonlyMap<string, string>) => Promise<Rater>;
}

export function parseArgs(argv: readonly string[]): { cmd: string; args: Map<string, string>; flags: Set<string> } {
  const [cmd = '', ...rest] = argv;
  const args = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i] as string;
    if (!a.startsWith('--')) throw new Error(`unexpected argument '${a}'`);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) flags.add(a);
    else { args.set(a, next); i += 1; }
  }
  return { cmd, args, flags };
}

const readJson = <T>(f: string): T => JSON.parse(fs.readFileSync(f, 'utf8')) as T;
function writeJson(f: string, v: unknown): void {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);
}

function need(args: ReadonlyMap<string, string>, name: string): string {
  const v = args.get(name);
  if (v === undefined || v === '') throw new Error(`${name} is required`);
  return v;
}

function datasetsOf(args: ReadonlyMap<string, string>): DatasetId[] {
  const d = args.get('--dataset');
  if (d === undefined) return [...DATASET_IDS];
  if (!(DATASET_IDS as readonly string[]).includes(d)) throw new Error(`--dataset must be one of ${DATASET_IDS.join(', ')}`);
  return [d as DatasetId];
}

/** The data directory must lie outside the repository (downloads and code are never committed). */
export function dataDirOf(args: ReadonlyMap<string, string>, repoRoot: string): string {
  const d = path.resolve(need(args, '--data'));
  const rel = path.relative(path.resolve(repoRoot), d);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) throw new Error('--data must be outside the repository');
  return d;
}

export function loadItems(dataset: DatasetId, dataDir: string): CalibrationItem[] {
  if (dataset === 'mlcq') return parseMlcq(fs.readFileSync(path.join(dataDir, 'mlcq', 'MLCQCodeSmellSamples.csv'), 'utf8'));
  return parseDacos(fs.readFileSync(path.join(dataDir, 'dacos', 'DACOSMain.sql'), 'utf8'));
}

function archiveFor(dataset: DatasetId, dataDir: string, entries: readonly string[]): ((e: string) => string | null) | undefined {
  if (dataset !== 'dacos') return undefined;
  const zip = fs.readFileSync(path.join(dataDir, 'dacos', 'files.zip'));
  const got = readZipEntries(zip, new Set(entries));
  return (e) => got.get(e) ?? null;
}

// ── Sample files ────────────────────────────────────────────────────────────

export interface SampleFile {
  readonly dataset: DatasetId;
  readonly design: SampleDesign;
  readonly tasksSha256: string;
  readonly perStratum: Record<string, unknown>;
  readonly items: readonly (Omit<ResolvedItem, 'code'> & { readonly codeLines: number })[];
}

export interface PromptRecord {
  readonly itemId: string;
  readonly rater: RaterId;
  readonly arm: Arm;
  readonly runIndex: number;
  readonly systemSha256: string;
  readonly promptSha256: string;
  readonly schemaSha256: string;
}

export interface PromptsFile {
  readonly dataset: DatasetId;
  readonly seed: number;
  readonly tasksSha256: string;
  readonly calls: number;
  readonly records: readonly PromptRecord[];
  /** sha256 over the records' canonical lines: one number to quote in the plan. */
  readonly manifestSha256: string;
}

export function promptRecords(items: readonly ResolvedItem[], raters: readonly RaterId[], seed: number): PromptRecord[] {
  const out: PromptRecord[] = [];
  for (const it of items) {
    for (const rater of raters) {
      for (const arm of ARMS) {
        for (const c of callsFor(it, arm, rater, seed)) {
          out.push({ itemId: it.id, rater, arm, runIndex: c.runIndex, systemSha256: sha256(c.system), promptSha256: sha256(c.prompt), schemaSha256: sha256(c.schema) });
        }
      }
    }
  }
  return out;
}

export function manifestSha(records: readonly PromptRecord[]): string {
  return createHash('sha256').update(records.map((r) => [r.itemId, r.rater, r.arm, r.runIndex, r.systemSha256, r.promptSha256, r.schemaSha256].join('\t')).join('\n')).digest('hex');
}

function resultsDir(repoRoot: string, dataset: DatasetId): string {
  return path.join(repoRoot, RESULTS_DIR, dataset);
}

/** Rebuilds the committed sample from the local data directory (offline) and checks every code hash. */
export async function loadSample(repoRoot: string, dataset: DatasetId, dataDir: string): Promise<ResolvedItem[]> {
  const file = readJson<SampleFile>(path.join(resultsDir(repoRoot, dataset), 'sample.json'));
  if (file.tasksSha256 !== tasksSha256()) throw new Error(`${dataset}: task definitions differ from the pre-registered ones (tasksSha256)`);
  const all = new Map(loadItems(dataset, dataDir).map((i) => [i.id, i]));
  const archive = archiveFor(dataset, dataDir, file.items.flatMap((i) => (i.archiveEntry === undefined ? [] : [i.archiveEntry])));
  const resolve = codeResolver(dataDir, nodeFetcher, true, archive);
  const out: ResolvedItem[] = [];
  for (const rec of file.items) {
    const it = all.get(rec.id);
    if (it === undefined) throw new Error(`${rec.id}: not in the local dataset copy`);
    const r = await resolve(it);
    if ('skip' in r) throw new Error(`${rec.id}: code not available locally (${r.skip}); run \`sample\` first`);
    if (r.codeSha256 !== rec.codeSha256) throw new Error(`${rec.id}: code hash ${r.codeSha256} differs from the pre-registered ${rec.codeSha256}`);
    out.push(r);
  }
  return out;
}

/** Refuses when any prompt of (rater, arm) differs from the committed prompts.json. */
export function checkPrompts(repoRoot: string, dataset: DatasetId, items: readonly ResolvedItem[], rater: RaterId, arm: Arm, seed: number): void {
  const frozen = readJson<PromptsFile>(path.join(resultsDir(repoRoot, dataset), 'prompts.json'));
  const key = (r: PromptRecord): string => `${r.itemId}|${r.rater}|${r.arm}|${String(r.runIndex)}`;
  const want = new Map(frozen.records.map((r) => [key(r), r]));
  const realRater: RaterId = rater === 'fake-claude' ? 'claude' : rater === 'fake-gemini' ? 'gemini' : rater;
  for (const r of promptRecords(items, [realRater], seed).filter((x) => x.arm === arm)) {
    const w = want.get(key(r));
    if (w === undefined || w.promptSha256 !== r.promptSha256 || w.systemSha256 !== r.systemSha256 || w.schemaSha256 !== r.schemaSha256) {
      throw new Error(`${key(r)}: prompt differs from the pre-registered prompts.json`);
    }
  }
}

// ── Commands ────────────────────────────────────────────────────────────────

async function cmdFetch(args: ReadonlyMap<string, string>, io: Io): Promise<number> {
  const dataDir = dataDirOf(args, io.repoRoot);
  const { sources } = readJson<{ sources: DatasetSource[] }>(path.join(io.repoRoot, SOURCES_FILE));
  for (const s of sources.filter((x) => datasetsOf(args).includes(x.dataset as DatasetId))) await fetchSource(s, dataDir, io.fetcher ?? nodeFetcher, (l) => io.out(`${l}\n`));
  return 0;
}

async function cmdSample(args: ReadonlyMap<string, string>, flags: ReadonlySet<string>, io: Io): Promise<number> {
  const dataDir = dataDirOf(args, io.repoRoot);
  for (const dataset of datasetsOf(args)) {
    const design = DESIGNS[dataset];
    const items = loadItems(dataset, dataDir);
    const archive = archiveFor(dataset, dataDir, items.flatMap((i) => (i.archiveEntry === undefined ? [] : [i.archiveEntry])));
    const r = await resolveSample(items, design, codeResolver(dataDir, io.fetcher ?? nodeFetcher, flags.has('--offline'), archive));
    const sample: SampleFile = {
      dataset, design, tasksSha256: tasksSha256(), perStratum: r.perStratum,
      items: r.items.map(({ code, ...rest }) => ({ ...rest, codeLines: code.split('\n').length })),
    };
    const records = promptRecords(r.items, REAL_RATERS, design.seed);
    const prompts: PromptsFile = { dataset, seed: design.seed, tasksSha256: tasksSha256(), calls: records.length, records, manifestSha256: manifestSha(records) };
    writeJson(path.join(resultsDir(io.repoRoot, dataset), 'sample.json'), sample);
    writeJson(path.join(resultsDir(io.repoRoot, dataset), 'prompts.json'), prompts);
    const short = Object.entries(r.perStratum).map(([k, v]) => `${k} ${String((v as { taken: number }).taken)}/${String(design.perStratum)}`).join(', ');
    io.out(`${dataset}: ${String(r.items.length)} items (${short}); ${String(records.length)} calls; manifest ${prompts.manifestSha256}\n`);
  }
  return 0;
}

function raterArmList(args: ReadonlyMap<string, string>): { raters: RaterId[]; arms: Arm[] } {
  const r = args.get('--rater');
  const a = args.get('--arm');
  if (r !== undefined && !(REAL_RATERS as readonly string[]).includes(r)) throw new Error('--rater must be claude or gemini');
  if (a !== undefined && !(ARMS as readonly string[]).includes(a)) throw new Error('--arm must be judge or labeller');
  return { raters: r === undefined ? [...REAL_RATERS] : [r as RaterId], arms: a === undefined ? [...ARMS] : [a as Arm] };
}

async function cmdDryRun(args: ReadonlyMap<string, string>, flags: ReadonlySet<string>, io: Io): Promise<number> {
  const dataDir = dataDirOf(args, io.repoRoot);
  const { raters, arms } = raterArmList(args);
  const print = args.get('--print') ?? '1';
  io.out('DRY RUN: no model is called.\n\n');
  const table: string[] = ['| Dataset | Rater | Arm | Items | Runs/item | Calls | In cassette | To call | Worst case |', '|---|---|---|---|---|---|---|---|---|'];
  let total = 0;
  let totalWorst = 0;
  for (const dataset of datasetsOf(args)) {
    const items = await loadSample(io.repoRoot, dataset, dataDir);
    let shown = 0;
    const limit = print === 'all' ? Number.POSITIVE_INFINITY : print === 'none' ? 0 : Number(print);
    for (const rater of raters) {
      for (const arm of arms) {
        checkPrompts(io.repoRoot, dataset, items, rater, arm, DESIGNS[dataset].seed);
        const cassette = new Cassette(cassetteDir(io.repoRoot, dataset), 'replay');
        let hits = 0;
        for (const it of items) {
          for (const c of callsFor(it, arm, rater, DESIGNS[dataset].seed)) {
            if (cassette.has(cassetteKeyFor(rater, arm, c))) hits += 1;
            if (shown < limit) {
              io.out(`===== ${it.id} | ${rater} | ${arm} | run ${String(c.runIndex)} =====\n--- system ---\n${c.system}\n--- schema sha256 ${sha256(c.schema)} ---\n--- prompt ---\n${c.prompt}\n\n`);
              shown += 1;
            }
          }
        }
        const est = callEstimate(items.length, rater, arm);
        total += est.calls - hits;
        totalWorst += est.worstCase;
        table.push(`| ${dataset} | ${rater} | ${arm} | ${String(items.length)} | ${String(runsFor(arm, rater))} | ${String(est.calls)} | ${String(hits)} | ${String(est.calls - hits)} | ${String(est.worstCase)} |`);
      }
    }
  }
  io.out(`${table.join('\n')}\n\nCalls still to make: ${String(total)} (worst case with every retry and re-ask: ${String(totalWorst)}).\n`);
  if (flags.has('--fake')) return fakePipeline(args, io, dataDir);
  return 0;
}

function cassetteDir(repoRoot: string, dataset: DatasetId): string {
  return path.join(repoRoot, RESULTS_DIR, 'cassettes', dataset);
}

/** The first-attempt cassette key of a call (labeller re-asks have their own keys and are not counted). */
function cassetteKeyFor(rater: RaterId, arm: Arm, c: { system: string; prompt: string; schema: string; runIndex: number }): string {
  const model = rater === 'claude' ? CLAUDE_MODEL : GEMINI_MODEL;
  return cassetteKey(rater, model, arm, { system: c.system, prompt: c.prompt, schema: c.schema }, c.runIndex);
}

/** FAKE raters through a throw-away cassette: checks the whole pipeline end to end; the numbers mean nothing. */
async function fakePipeline(args: ReadonlyMap<string, string>, io: Io, dataDir: string): Promise<number> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'labeller-cal-fake-'));
  try {
    const scores = [];
    for (const dataset of datasetsOf(args)) {
      const items = await loadSample(io.repoRoot, dataset, dataDir);
      const truth = new Map<string, 'fail' | 'pass'>();
      for (const it of items) truth.set(it.code, consensus(it) ?? 'pass');
      const truthOf = (prompt: string): 'fail' | 'pass' => {
        for (const it of items) if (prompt.includes(it.displayPath) && prompt.includes(it.unitName)) return truth.get(it.code) ?? 'pass';
        return 'pass';
      };
      const labels: RaterLabel[] = [];
      for (const p of DRY_RUN_FAKES) {
        const rater = fakeRater(p, truthOf);
        for (const arm of ARMS) labels.push(...await labelSample(items, rater, arm, { seed: DESIGNS[dataset].seed, cassette: new Cassette(path.join(tmp, dataset), 'record'), budget: { cap: Number.POSITIVE_INFINITY, used: 0 } }));
      }
      scores.push(scoreDataset(dataset, items, labels));
    }
    io.out(`\n${renderScores(scores, '# FAKE raters (pipeline check only; the numbers mean nothing)')}\n`);
    return 0;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function defaultMakeRater(id: RaterId, args: ReadonlyMap<string, string>): Promise<Rater> {
  const runner = new NodeProcessRunner();
  const tmpRoot = args.get('--tmp-root');
  if (id === 'claude') return claudeRater({ runner, ...(args.has('--claude-config-dir') && { configDir: args.get('--claude-config-dir') as string }), ...(tmpRoot !== undefined && { tmpRoot }) });
  return geminiRater({
    runner, ...(tmpRoot !== undefined && { tmpRoot }),
    ...(args.has('--agy-home') && { home: args.get('--agy-home') as string }),
    ...(args.has('--agy-accept-version') && { acceptVersion: args.get('--agy-accept-version') as string }),
  });
}

function labelsFile(repoRoot: string, dataset: DatasetId, rater: RaterId, arm: Arm): string {
  return path.join(resultsDir(repoRoot, dataset), 'labels', `${rater}-${arm}.json`);
}

async function cmdRecord(args: ReadonlyMap<string, string>, io: Io): Promise<number> {
  const dataDir = dataDirOf(args, io.repoRoot);
  const ds = datasetsOf(args);
  if (ds.length !== 1 || !args.has('--rater') || !args.has('--arm')) throw new Error('record needs --dataset, --rater and --arm');
  const dataset = ds[0] as DatasetId;
  const { raters: [rater], arms: [arm] } = raterArmList(args);
  const cap = Number(need(args, '--budget'));
  if (!Number.isInteger(cap) || cap < 0) throw new Error('--budget must be a non-negative integer');
  const tmpRoot = need(args, '--tmp-root');
  if (!fs.existsSync(tmpRoot)) throw new Error('--tmp-root must be an existing directory outside any repository');
  const items = await loadSample(io.repoRoot, dataset, dataDir);
  checkPrompts(io.repoRoot, dataset, items, rater as RaterId, arm as Arm, DESIGNS[dataset].seed);
  const r = await (io.makeRater ?? defaultMakeRater)(rater as RaterId, args);
  const budget = { cap, used: 0 };
  let stopped: string | undefined;
  let labels: RaterLabel[] = [];
  try {
    labels = await labelSample(items, r, arm as Arm, {
      seed: DESIGNS[dataset].seed, cassette: new Cassette(cassetteDir(io.repoRoot, dataset), 'record'), budget,
      log: (l) => io.err(`${l}\n`),
    });
  } catch (e) {
    if (e instanceof BudgetExhaustedError || e instanceof CassetteMissError || (e instanceof RaterError && e.kind === 'stop')) {
      stopped = `${(e as { code: string }).code}: ${e.message}`.replace(/\/(Users|Volumes|private|home)\/[^\s'"]*/g, '<path>');
    } else throw e;
  } finally {
    r.dispose?.();
  }
  if (stopped === undefined) {
    writeJson(labelsFile(io.repoRoot, dataset, rater as RaterId, arm as Arm), { dataset, rater, arm, model: r.model, provenance: r.provenance, complete: true, labels });
  }
  io.out(`${dataset} ${String(rater)} ${String(arm)}: ${String(budget.used)} calls made${stopped !== undefined ? `; STOPPED ${stopped} (re-run to resume from the cassette)` : `; labels written`}\n`);
  return stopped === undefined ? 0 : 3;
}

/** The same items with every MLCQ rating re-mapped from its original severity (plan §3.2 sensitivity mapping). */
export function remapMlcq(items: readonly CalibrationItem[], mapping: MlcqMapping): CalibrationItem[] {
  return items.map((i) => ({ ...i, ratings: i.ratings.map((r) => ({ ...r, binary: mapMlcq(r.original, mapping) })) }));
}

function cmdScore(io: Io): Promise<number> {
  const scores = [];
  const sensitivity = [];
  for (const dataset of DATASET_IDS) {
    const dir = resultsDir(io.repoRoot, dataset);
    if (!fs.existsSync(path.join(dir, 'sample.json'))) continue;
    const sample = readJson<SampleFile>(path.join(dir, 'sample.json'));
    const labels: RaterLabel[] = [];
    for (const rater of REAL_RATERS) for (const arm of ARMS) {
      const f = labelsFile(io.repoRoot, dataset, rater, arm);
      if (fs.existsSync(f)) labels.push(...readJson<{ labels: RaterLabel[] }>(f).labels);
    }
    if (labels.length === 0) continue;
    const items = sample.items as unknown as CalibrationItem[];
    scores.push(scoreDataset(dataset, items, labels));
    if (dataset === 'mlcq') sensitivity.push(scoreDataset(dataset, remapMlcq(items, 'major-or-worse'), labels));
  }
  if (scores.length === 0) {
    io.out('no labels recorded yet: nothing to score\n');
    return Promise.resolve(0);
  }
  const md = [
    renderScores(scores, `# Labeller calibration: results\n\nDecision rule ${DECISION_RULE.id} (Docs/v1.3/labeller-calibration-plan.md §6). Generated by \`score\`.`),
    ...(sensitivity.length > 0 ? [renderScores(sensitivity, '# Sensitivity: MLCQ major-or-worse mapping (secondary; not a decision)')] : []),
  ].join('\n');
  fs.writeFileSync(path.join(io.repoRoot, RESULTS_DIR, 'report.md'), `${md}\n`);
  writeJson(path.join(io.repoRoot, RESULTS_DIR, 'report.json'), { rule: DECISION_RULE, scores, sensitivityMlcqMajorOrWorse: sensitivity });
  io.out(md);
  return Promise.resolve(0);
}

export async function calibrationMain(argv: readonly string[], io: Io): Promise<number> {
  const { cmd, args, flags } = parseArgs(argv);
  switch (cmd) {
    case 'fetch': return cmdFetch(args, io);
    case 'sample': return cmdSample(args, flags, io);
    case 'dry-run': return cmdDryRun(args, flags, io);
    case 'record': return cmdRecord(args, io);
    case 'score': return cmdScore(io);
    default:
      io.err('usage: calibrate.ts fetch|sample|dry-run|record|score (see Docs/v1.3/labeller-calibration-plan.md §8)\n');
      return 2;
  }
}
