/**
 * `model-panel.ts` subcommands (Docs/v1.3/model-panel.md §7).
 *
 * build    --out-dir <dir> --seed <n> [--wild <review-sheet.md> [--wild-key <review-key.json>]]
 *          [--union-sheet <sheet.md> --union-key <key.json>] [--external <labelling-sheet.csv> --external-root <dir>]
 *          [--decoys-correct 15] [--decoys-wrong 15] [--decoy-root tests/fixtures/v1.3-reference] [--limit-targets <n>]
 *   -> <dir>/panel-set.json (what raters see) and <dir>/panel-key.json (origin, rule, decoy truth; never sent).
 * estimate --set <panel-set.json> [--raters 3]
 * run      --set <panel-set.json> --key <panel-key.json> --out-dir <dir> --seed <n> --mode record|replay
 *          [--cassettes <dir>] [--gemini <model>] [--openai <model> | --codex <model> --codex-home <abs> --codex-user-home <abs>]
 *          [--claude <model> [--claude-config-dir <dir>] [--claude-bin <path>]] [--human <name>=<answers.csv>]…
 *          [--exclude-vendor google|openai|anthropic]   (leave-one-vendor-out reading: --mode replay, a new --out-dir,
 *          --labels <first run>/labels.json and --cassettes <first run>/cassettes)
 *   -> <dir>/labels.json, <dir>/report.json, <dir>/report.md. Keys come from GEMINI_API_KEY / OPENAI_API_KEY only.
 * dry-run  [--out-dir results/v1.3-panel/dry-run] [--seed 20261016]
 *   40 items (20 wild targets, 10 known-correct and 10 known-wrong reference decoys), three FAKE raters, record then
 *   replay; no real model is called.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expandHome } from '../../../../src/cli/llm-options.js';
import { loadStyleSources } from '../labelling/meaningful-prompt.js';
import type { UnionKeyRow } from '../labelling/union.js';
import { GEMINI_KEY_ENV, ProviderError } from '../labelling/providers.js';
import type { CassetteMode } from '../labelling/providers.js';
import { REFERENCE_ROOT, loadAllReferences } from '../reference-model.js';
import {
  DRY_RUN_PROFILES, OPENAI_KEY_ENV, PANEL_CLAUDE_CONFIG_DIR_DEFAULT, claimOfPrompt, claudeRater, codexRater, fakeRater, geminiRater, openAiRater, unit,
} from './adapters.js';
import type { PanelRater } from './adapters.js';
import { assemble, externalItems, parseCsv, referenceDecoys, unionItems, wildItems } from './items.js';
import type { Loaded, PanelKeyFile, PanelSet } from './items.js';
import { renderPanelPrompt } from './prompt.js';
import { estimatePanel, runPanel } from './run.js';
import type { PanelLabels } from './run.js';
import { panelReport, renderPanelReport } from './stats.js';

export interface PanelIo {
  readonly env: NodeJS.ProcessEnv;
  readonly out: (t: string) => void;
  readonly err: (t: string) => void;
}

export function parseArgs(argv: readonly string[]): { cmd: string; args: Map<string, string>; multi: Map<string, string[]> } {
  const [cmd = '', ...rest] = argv;
  const args = new Map<string, string>();
  const multi = new Map<string, string[]>();
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i] ?? '';
    if (!a.startsWith('--')) continue;
    const name = a.slice(2);
    const next = rest[i + 1];
    const v = next !== undefined && !next.startsWith('--') ? (i += 1, next) : 'true';
    args.set(name, v);
    multi.set(name, [...(multi.get(name) ?? []), v]);
  }
  return { cmd, args, multi };
}

function need(args: ReadonlyMap<string, string>, name: string): string {
  const v = args.get(name);
  if (v === undefined || v === 'true') throw new Error(`--${name} <value> is required`);
  return v;
}
const readJson = <T>(f: string): T => JSON.parse(fs.readFileSync(f, 'utf8')) as T;
function writeFile(file: string, text: string): void {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, text);
}
const writeJson = (file: string, v: unknown): void => writeFile(file, `${JSON.stringify(v, null, 2)}\n`);

// ── build ───────────────────────────────────────────────────────────────────

export interface BuildInput {
  readonly seed: number;
  readonly wild?: { readonly sheet: string; readonly key?: { items: { id: string; rule: string; repo: string }[] } };
  readonly union?: { readonly sheet: string; readonly rows: readonly UnionKeyRow[] };
  readonly external?: { readonly csv: string; readonly root: string };
  readonly decoysCorrect: number;
  readonly decoysWrong: number;
  readonly decoyRoot: string;
  readonly limitTargets?: number;
}

export function buildPanel(repoRoot: string, b: BuildInput): { set: PanelSet; key: PanelKeyFile; shortfall: { correct: number; wrong: number } } {
  const styleDoc = loadStyleSources(repoRoot);
  const loads: Loaded[] = [];
  if (b.union !== undefined) loads.push(unionItems(b.union.sheet, b.union.rows, styleDoc));
  if (b.external !== undefined) loads.push(externalItems(b.external.csv, b.external.root, styleDoc));
  if (b.wild !== undefined) loads.push(wildItems(b.wild.sheet, b.wild.key));
  if (b.limitTargets !== undefined) {
    let left = b.limitTargets;
    for (const [i, l] of loads.entries()) {
      const take = Math.min(left, l.items.length);
      loads[i] = { ...l, items: l.items.slice(0, take), key: l.key.slice(0, take) };
      left -= take;
    }
  }
  const exclude = new Set(b.union?.rows.map((r) => r.projectId) ?? []);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-panel-decoys-'));
  try {
    const refs = loadAllReferences(repoRoot, undefined, b.decoyRoot);
    const d = referenceDecoys(refs, styleDoc, { seed: b.seed, correct: b.decoysCorrect, wrong: b.decoysWrong, materialiseRoot: tmp, excludeProjects: exclude });
    loads.push(d);
    const { set, key } = assemble(loads, b.seed);
    return { set, key, shortfall: d.shortfall };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ── humans ──────────────────────────────────────────────────────────────────

/** `name=answers.csv` (columns itemId,answer): the id is a panel id (P001) or the source sheet's id (W07, U012). */
export function loadHuman(spec: string, key: PanelKeyFile): [string, Map<string, string>] {
  const eq = spec.indexOf('=');
  if (eq <= 0) throw new Error(`--human expects <name>=<answers.csv>, got ${spec}`);
  const name = spec.slice(0, eq);
  const [header = [], ...rows] = parseCsv(fs.readFileSync(spec.slice(eq + 1), 'utf8'));
  const ii = header.indexOf('itemId');
  const ia = header.indexOf('answer');
  const bySource = new Map(key.rows.map((r) => [r.sourceId, r.id]));
  const ids = new Set(key.rows.map((r) => r.id));
  const out = new Map<string, string>();
  for (const r of rows) {
    const raw = (r[ii] ?? '').trim();
    const id = ids.has(raw) ? raw : bySource.get(raw);
    const a = (r[ia] ?? '').trim().toLowerCase();
    if (id !== undefined) out.set(id, a === 'tp' ? 'yes' : a === 'fp' || a === 'true-benign' ? 'no' : a === '?' ? 'uncertain' : a);
  }
  return [`human:${name}`, out];
}

// ── run ─────────────────────────────────────────────────────────────────────

async function liveRaters(args: ReadonlyMap<string, string>, io: PanelIo, repoRoot: string): Promise<{ raters: PanelRater[]; dispose: () => void; secrets: string[] }> {
  const raters: PanelRater[] = [];
  const disposers: (() => void)[] = [];
  const secrets = [io.env[GEMINI_KEY_ENV] ?? '', io.env[OPENAI_KEY_ENV] ?? ''].filter((s) => s !== '');
  const g = args.get('gemini');
  if (g !== undefined) raters.push(geminiRater(g, io.env));
  const oa = args.get('openai');
  const cx = args.get('codex');
  if (oa !== undefined && cx !== undefined) throw new Error('one OpenAI rater per run: --openai or --codex, not both');
  if (oa !== undefined) raters.push(openAiRater(oa, io.env));
  if (cx !== undefined) raters.push(codexRater({ model: cx, codexHome: need(args, 'codex-home'), userHome: need(args, 'codex-user-home') }, undefined, io.env));
  const c = args.get('claude');
  if (c !== undefined) {
    const r = await claudeRater({
      model: c, configDir: expandHome(args.get('claude-config-dir') ?? PANEL_CLAUDE_CONFIG_DIR_DEFAULT),
      ...(args.has('claude-bin') && { binary: args.get('claude-bin') ?? 'claude' }), projectRoot: repoRoot,
    });
    raters.push(r.rater);
    disposers.push(r.dispose);
  }
  return { raters, dispose: () => { for (const d of disposers) d(); }, secrets };
}

/** Replay raters: they carry the ids the cassettes were recorded under and never call. */
function replayRaters(labelsFile: string | undefined, args: ReadonlyMap<string, string>): PanelRater[] {
  const never = (): Promise<never> => Promise.reject(new ProviderError('CASSETTE_MISS', 'replay never calls the provider', 'stop'));
  const out: PanelRater[] = [];
  const add = (vendor: PanelRater['vendor'], id: PanelRater['provider']['id'], model: string): void => {
    out.push({ name: `${vendor}:${model}`, vendor, provider: { id, model, call: never } });
  };
  if (labelsFile !== undefined && fs.existsSync(labelsFile)) {
    for (const r of readJson<PanelLabels>(labelsFile).raters) add(r.vendor as PanelRater['vendor'], r.provider as PanelRater['provider']['id'], r.model);
    return out;
  }
  if (args.has('gemini')) add('google', 'gemini', need(args, 'gemini'));
  if (args.has('openai')) add('openai', 'openai-api', need(args, 'openai'));
  if (args.has('codex')) add('openai', 'codex', need(args, 'codex'));
  if (args.has('claude')) add('anthropic', 'claude-cli', need(args, 'claude'));
  return out;
}

function writeOutputs(outDir: string, key: PanelKeyFile, labels: PanelLabels, humans: Map<string, Map<string, string>>, title: string): void {
  const report = panelReport(key, labels, humans);
  writeJson(path.join(outDir, 'labels.json'), labels);
  writeJson(path.join(outDir, 'report.json'), report);
  writeFile(path.join(outDir, 'report.md'), renderPanelReport(report, title));
}

// ── dry run ─────────────────────────────────────────────────────────────────

export const DRY_RUN_SEED = 20261016;
export const DRY_RUN_TARGETS = 20;
export const DRY_RUN_DECOYS = 10;
/** Share of target items whose latent (fake) truth is `yes`. */
export const DRY_RUN_LATENT_YES = 0.6;

export async function dryRun(repoRoot: string, outDir: string, seed: number, io: PanelIo): Promise<number> {
  const wildDir = path.join(repoRoot, 'results/v1.3-wild');
  const { set, key, shortfall } = buildPanel(repoRoot, {
    seed, decoysCorrect: DRY_RUN_DECOYS, decoysWrong: DRY_RUN_DECOYS, decoyRoot: REFERENCE_ROOT, limitTargets: DRY_RUN_TARGETS,
    wild: { sheet: fs.readFileSync(path.join(wildDir, 'review-sheet.md'), 'utf8'), key: readJson(path.join(wildDir, 'review-key.json')) },
  });
  writeJson(path.join(outDir, 'panel-set.json'), set);
  writeJson(path.join(outDir, 'panel-key.json'), key);
  // The fakes' oracle: decoys from the key, targets from a seeded latent truth. Real raters never get one.
  const truth = new Map<string, 'yes' | 'no'>();
  for (const it of set.items) {
    const k = key.rows.find((r) => r.id === it.id);
    const ck = claimOfPrompt(renderPanelPrompt(it, ['yes', 'no', 'uncertain']));
    truth.set(ck, k?.truth ?? (unit(String(seed), 'latent', it.key) < DRY_RUN_LATENT_YES ? 'yes' : 'no'));
  }
  const oracle = (ck: string): 'yes' | 'no' => truth.get(ck) ?? 'no';
  const raters = DRY_RUN_PROFILES.map((p) => fakeRater(p, oracle));
  const cassettes = path.join(outDir, 'cassettes');
  const recorded = await runPanel(set, raters, { seed, cassetteRoot: cassettes, mode: 'record' });
  const replayed = await runPanel(set, raters.map((r) => ({ ...r, provider: { ...r.provider, call: () => Promise.reject(new Error('replay called a provider')) } })), { seed, cassetteRoot: cassettes, mode: 'replay' });
  const same = JSON.stringify(recorded.labels) === JSON.stringify(replayed.labels);
  writeOutputs(outDir, key, replayed, new Map(), 'v1.3 model panel: DRY RUN with fake raters (not a result)');
  const { calls } = estimatePanel(set.items.length, raters.length);
  io.out(`dry run: ${String(set.items.length)} items (${String(key.rows.filter((r) => r.truth === undefined).length)} targets, ${String(key.rows.filter((r) => r.truth === 'yes').length)} known-correct, ${String(key.rows.filter((r) => r.truth === 'no').length)} known-wrong decoys; shortfall ${JSON.stringify(shortfall)}), ${String(raters.length)} fake raters, ${String(calls)} planned calls; replay identical: ${String(same)} -> ${outDir}\n`);
  return same ? 0 : 1;
}

// ── entry ───────────────────────────────────────────────────────────────────

export async function panelMain(argv: readonly string[], repoRoot: string, io: PanelIo): Promise<number> {
  const { cmd, args, multi } = parseArgs(argv);
  const seed = Number(args.get('seed') ?? DRY_RUN_SEED);
  if (cmd === 'dry-run') return dryRun(repoRoot, args.get('out-dir') ?? 'results/v1.3-panel/dry-run', seed, io);
  if (cmd === 'build') {
    const outDir = need(args, 'out-dir');
    const wild = args.get('wild');
    const us = args.get('union-sheet');
    const ext = args.get('external');
    const { set, key, shortfall } = buildPanel(repoRoot, {
      seed,
      ...(wild !== undefined && { wild: { sheet: fs.readFileSync(wild, 'utf8'), ...(args.has('wild-key') && { key: readJson(need(args, 'wild-key')) }) } }),
      ...(us !== undefined && { union: { sheet: fs.readFileSync(us, 'utf8'), rows: readJson<{ rows: UnionKeyRow[] }>(need(args, 'union-key')).rows } }),
      ...(ext !== undefined && { external: { csv: fs.readFileSync(ext, 'utf8'), root: need(args, 'external-root') } }),
      decoysCorrect: Number(args.get('decoys-correct') ?? 15), decoysWrong: Number(args.get('decoys-wrong') ?? 15),
      decoyRoot: args.get('decoy-root') ?? REFERENCE_ROOT,
      ...(args.has('limit-targets') && { limitTargets: Number(args.get('limit-targets')) }),
    });
    writeJson(path.join(outDir, 'panel-set.json'), set);
    writeJson(path.join(outDir, 'panel-key.json'), key);
    io.out(`build: ${String(set.items.length)} items (${String(key.rows.filter((r) => r.truth === undefined).length)} targets, ${String(key.rows.filter((r) => r.truth !== undefined).length)} decoys), ${String(key.excluded.length)} excluded -> ${outDir}\n`);
    if (shortfall.correct > 0 || shortfall.wrong > 0) io.err(`note: decoy shortfall ${JSON.stringify(shortfall)}\n`);
    return 0;
  }
  if (cmd === 'estimate') {
    const set = readJson<PanelSet>(need(args, 'set'));
    const raters = Number(args.get('raters') ?? 3);
    const e = estimatePanel(set.items.length, raters);
    const chars = set.items.reduce((s, it) => s + renderPanelPrompt(it, ['yes', 'no', 'uncertain']).length, 0);
    io.out(`estimate: ${String(e.calls)} calls (${String(set.items.length)} items x ${String(raters)} raters x 2 runs); worst case ${String(e.worstCase)}; ~${String(Math.round(chars / 4 / Math.max(set.items.length, 1)))} prompt tokens per call (chars/4)\n`);
    return 0;
  }
  if (cmd === 'run') {
    const set = readJson<PanelSet>(need(args, 'set'));
    const key = readJson<PanelKeyFile>(need(args, 'key'));
    const outDir = need(args, 'out-dir');
    const mode = need(args, 'mode') as CassetteMode;
    if (mode !== 'record' && mode !== 'replay') throw new Error('--mode must be record or replay');
    const cassettes = args.get('cassettes') ?? path.join(outDir, 'cassettes');
    const humans = new Map((multi.get('human') ?? []).map((s) => loadHuman(s, key)));
    const live = mode === 'record' ? await liveRaters(args, io, repoRoot) : { raters: replayRaters(args.get('labels') ?? path.join(outDir, 'labels.json'), args), dispose: () => undefined, secrets: [] };
    const drop = new Set(multi.get('exclude-vendor') ?? []);
    const raters = live.raters.filter((r) => !drop.has(r.vendor));
    if (raters.length < 2) throw new Error('the panel needs at least two raters (--gemini, --openai|--codex, --claude)');
    try {
      const labels = await runPanel(set, raters, { seed, cassetteRoot: cassettes, mode, secrets: live.secrets, log: (l) => io.err(`${l}\n`) });
      writeOutputs(outDir, key, labels, humans, `v1.3 model panel${drop.size > 0 ? ` (without ${[...drop].join(', ')})` : ''}`);
      io.out(`run: ${String(set.items.length)} items x ${String(raters.length)} raters -> ${outDir}/report.md\n`);
      return 0;
    } catch (e) {
      if (e instanceof ProviderError && e.kind === 'stop') {
        io.err(`stopped (${e.code}): ${e.message}\nEverything answered so far is in ${cassettes}; the same command resumes.\n`);
        return 3;
      }
      throw e;
    } finally {
      live.dispose();
    }
  }
  io.err('usage: model-panel.ts build|estimate|run|dry-run … (see Docs/v1.3/model-panel.md §7)\n');
  return 2;
}
