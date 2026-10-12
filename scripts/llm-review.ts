/**
 * Plain LLM-review baseline pilot (ADR-036, exploratory; `Docs/analysis-plan.md` §15).
 *
 * A Codex CLI agent (`gpt-5.6-terra`, the ADR-029 pins) reads one project tree, read-only, with the project's
 * architecture spec rendered as prose, and lists every violation it finds as JSON (file, rule, reason). The same
 * pinned prompt runs 3 times per tree. The trees are 5 SO4 held-out seeded copies (one per operator MO-S01, MO-P01,
 * MO-C04, MO-SO01, MO-CV02, drawn by a registered seed on distinct bases), their 5 unseeded baselines, and the before
 * and after trees of 2 real fix-commit pairs. Scoring adapts the registered matching rule (MAT-02..04) and the ADR-030
 * real-pair rule to keys (rule, file).
 *
 * Steps (CLI `scripts/llm-review-cli.ts`):
 * - `select`   writes the registered review plan (selection, trees, seeds, pairs) from the SO4 manifest, the SO4 v2
 *              seed coverage and `corpus/real-violation-pairs.json` (pure, seeded).
 * - `prepare`  exports each tree to `../daedalus-llm-review/trees/<treeId>` (no `.git`, no mutant marker, no
 *              `node_modules`/`dist`, every mtime set to one fixed instant) and checks its digest against the plan.
 * - `prompts`  writes the rendered prompt of each tree (`results/llm-review/prompts/`).
 * - `run`      makes the live Codex calls in the registered order under the credit budget stop.
 * - `score`    writes the result tables (no model call).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { mulberry32 } from './lib/mutation/rng.js';
import {
  CODEX_DISABLED_FEATURES,
  buildCodexChildEnv,
  checkCodexHome,
  codexReadDenies,
  parseCodexVersion,
} from './lib/generators/codex-cli.js';
import { codexUsageLimit, lastRateLimits, parseCodexRun, rateLimitResetAt, takeRollout } from './lib/generators/codex-events.js';
import { NodeProcessRunner } from '../src/shared/process/node-process-runner.js';
import type { ProcessResult } from '../src/shared/interfaces/process-runner.js';
import { toCsv, wilson } from './tool-comparison.js';

type Json = Record<string, unknown>;

export const REVIEW_VERSION = '1.0.0';
export const REVIEW_PLAN = 'experiments/llm-review/review-plan.json';
export const OUTPUT_SCHEMA = 'experiments/llm-review/output-schema.json';
export const PROMPT_TEMPLATE = 'experiments/llm-review/prompt-template.md';
export const CASSETTE_DIR = 'experiments/llm-review/cassettes';
export const RESULTS_DIR = 'results/llm-review';
export const REVIEW_ROOT = '../daedalus-llm-review';
export const OPERATORS: readonly string[] = ['MO-S01', 'MO-P01', 'MO-C04', 'MO-SO01', 'MO-CV02'];
/** Held-out bases admitted to the draw (ADR-036 item 2): the five whose TypeScript source is under 300 kB. */
export const ADMITTED_BASES: readonly string[] = ['dry-run-test', 'realworld-test', 'truthy-demo', 'v-aguiar__valex', 'zhuravlevma__nestjs-active-record'];
/** Real pairs: p5 fixed, the second drawn from the pairs both rule tools detected (ADR-036 item 2). */
export const FIXED_PAIR = 'p5';
export const DRAWN_PAIR_POOL: readonly string[] = ['p3', 'p4'];
export const SELECTION_SEED = 9301;
/** Rate card for `gpt-5.6-terra` (credits per 1M tokens; `Docs/generator-protocol.md` §11). */
export const RATE_CARD = { input: 50, cached: 5, output: 300 } as const;
export const FIXED_MTIME = new Date('2026-01-01T00:00:00Z');
const EXCLUDED_NAMES: ReadonlySet<string> = new Set(['.git', '.daedalus-mutant.json', 'node_modules', 'dist', 'coverage', '.DS_Store']);

// --- plan types ----------------------------------------------------------------------------------------------------

export type TreeKind = 'seeded' | 'baseline' | 'pair-before' | 'pair-after';
export interface ReviewTree {
  readonly treeId: string;
  readonly kind: TreeKind;
  readonly projectId: string;
  readonly specPath: string;
  /** Source directory (repository-relative) the tree is exported from. */
  readonly source: string;
  /** Firewall report of the same tree (repository-relative), for the overlap analysis. */
  readonly firewallReport: string;
  /** sha256 over the sorted (path, sha256) list of the exported tree; filled by `prepare --pin`. */
  readonly digest?: string;
  readonly files?: number;
  /** sha256 of the rendered prompt; filled by `prompts --pin`. */
  readonly promptSha256?: string;
}
export interface ReviewSeed {
  readonly seedId: string;
  readonly operatorId: string;
  readonly treeId: string;
  readonly baselineTreeId: string;
  readonly dimension: string;
  readonly functionIds: readonly string[];
  readonly keys: readonly { readonly functionId: string; readonly filePath: string }[];
  readonly editedFiles: readonly string[];
  readonly createdFiles: readonly string[];
  readonly firewallStatus: string;
}
export interface TouchedFile { readonly status: string; readonly path: string; readonly from?: string }
export interface ReviewPair {
  readonly pair: string;
  readonly projectId: string;
  readonly beforeTreeId: string;
  readonly afterTreeId: string;
  readonly note: string;
  readonly touchedFiles: readonly TouchedFile[];
}
export interface ReviewPlan {
  readonly version: string;
  readonly adr: string;
  readonly reading: 'exploratory';
  readonly model: string;
  readonly cliVersion: string;
  readonly reasoningEffort: string;
  readonly modelCatalog: string;
  readonly modelCatalogSha256: string;
  readonly runs: number;
  readonly budgetCredits: number;
  readonly firstCallEstimateCredits: number;
  readonly timeoutMs: number;
  readonly selectionSeed: number;
  readonly order: string;
  readonly treesRoot: string;
  readonly trees: readonly ReviewTree[];
  readonly seeds: readonly ReviewSeed[];
  readonly pairs: readonly ReviewPair[];
}

// --- small helpers -------------------------------------------------------------------------------------------------

export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function writeFile(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function csvRows(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const head = (lines.shift() ?? '').split(',');
  return lines.map((l) => {
    const cells = l.split(',');
    const row: Record<string, string> = {};
    head.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}

/** All permutations of `items` (lexicographic in input order). */
export function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const out: T[][] = [];
  items.forEach((x, i) => {
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) out.push([x, ...rest]);
  });
  return out;
}

// --- selection (registered; pure) -----------------------------------------------------------------------------------

interface ManifestRow {
  readonly seedId: string;
  readonly projectId: string;
  readonly operatorId: string;
  readonly editedFiles?: readonly string[];
  readonly createdFiles?: readonly string[];
  readonly expected: {
    readonly functionIds: readonly string[];
    readonly disabledFunctionIds?: readonly string[];
    readonly dimension: string;
    readonly keys: readonly { readonly functionId: string; readonly filePath: string }[];
  };
}

export interface SelectionInputs {
  readonly manifestRows: readonly ManifestRow[];
  /** SO4 v2 seed coverage rows: seed_id → status. */
  readonly coverage: ReadonlyMap<string, string>;
  /** `corpus/real-violation-pairs.json` pairs in file order (p1..p5). */
  readonly pairs: readonly { readonly projectId: string; readonly beforeSha: string; readonly afterSha: string; readonly researchNote?: string; readonly touchedFiles: readonly TouchedFile[] }[];
  /** v2 report path (repository-relative) per seedId and per base projectId (baseline entries). */
  readonly so4Reports: ReadonlyMap<string, string>;
  /** real-pairs report path per `p<i>-<side>`. */
  readonly pairReports: ReadonlyMap<string, string>;
  readonly specOf: (projectId: string) => string;
}

export interface Selection {
  readonly assignment: readonly { readonly operatorId: string; readonly seedId: string }[];
  readonly feasibleAssignments: number;
  readonly drawnPair: string;
}

/**
 * The registered draw (ADR-036 item 2): over every bijection of the five operators onto the five admitted bases
 * (bases permuted in sorted order, operators in `OPERATORS` order) in which each operator has at least one seed that
 * SO4 v2 scored (`matched` or `missed`) on its base, pick one uniformly with mulberry32(`SELECTION_SEED`); then, in
 * operator order, pick one of that operator's scored seeds on its base (sorted by seed id); then pick the second pair
 * from `DRAWN_PAIR_POOL`.
 */
export function drawSelection(inputs: Pick<SelectionInputs, 'manifestRows' | 'coverage'>, seed: number = SELECTION_SEED): Selection {
  const scored = (r: ManifestRow): boolean => ['matched', 'missed'].includes(inputs.coverage.get(r.seedId) ?? '');
  const candidates = (op: string, base: string): string[] =>
    inputs.manifestRows.filter((r) => r.operatorId === op && r.projectId === base && scored(r)).map((r) => r.seedId).sort();
  const bases = [...ADMITTED_BASES].sort();
  const feasible = permutations(bases).filter((perm) => OPERATORS.every((op, i) => candidates(op, perm[i] as string).length > 0));
  if (feasible.length === 0) throw new Error('LLM_REVIEW_SELECTION_EMPTY: no feasible operator-to-base assignment');
  const rng = mulberry32(seed);
  const perm = feasible[Math.floor(rng.next() * feasible.length)] as string[];
  const assignment = OPERATORS.map((op, i) => {
    const c = candidates(op, perm[i] as string);
    return { operatorId: op, seedId: c[Math.floor(rng.next() * c.length)] as string };
  });
  const drawnPair = DRAWN_PAIR_POOL[Math.floor(rng.next() * DRAWN_PAIR_POOL.length)] as string;
  return { assignment, feasibleAssignments: feasible.length, drawnPair };
}

export function buildReviewPlan(inputs: SelectionInputs, pins: Omit<ReviewPlan, 'trees' | 'seeds' | 'pairs' | 'version' | 'adr' | 'reading' | 'selectionSeed' | 'order' | 'treesRoot'>): ReviewPlan {
  const sel = drawSelection(inputs);
  const trees: ReviewTree[] = [];
  const seeds: ReviewSeed[] = [];
  for (const { operatorId, seedId } of sel.assignment) {
    const row = inputs.manifestRows.find((r) => r.seedId === seedId);
    if (row === undefined) throw new Error(`seed ${seedId} missing from the manifest`);
    const k = seedId.split(':')[2] ?? '0';
    const seededId = `${row.projectId}--${operatorId}--k${k}`;
    const baselineId = `${row.projectId}--${operatorId}--k${k}--baseline`;
    const seededReport = inputs.so4Reports.get(seedId);
    const baseReport = inputs.so4Reports.get(row.projectId);
    if (seededReport === undefined || baseReport === undefined) throw new Error(`no SO4 v2 report for ${seedId}`);
    const source = `../daedalus-so4/copies/${row.projectId}/${operatorId}/k-${k}`;
    trees.push({ treeId: seededId, kind: 'seeded', projectId: row.projectId, specPath: inputs.specOf(row.projectId), source, firewallReport: seededReport });
    trees.push({ treeId: baselineId, kind: 'baseline', projectId: row.projectId, specPath: inputs.specOf(row.projectId), source, firewallReport: baseReport });
    const disabled = new Set(row.expected.disabledFunctionIds ?? []);
    seeds.push({
      seedId,
      operatorId,
      treeId: seededId,
      baselineTreeId: baselineId,
      dimension: row.expected.dimension,
      functionIds: row.expected.functionIds.filter((f) => !disabled.has(f)),
      keys: row.expected.keys.filter((key) => !disabled.has(key.functionId)).map((key) => ({ functionId: key.functionId, filePath: key.filePath })),
      editedFiles: row.editedFiles ?? [],
      createdFiles: row.createdFiles ?? [],
      firewallStatus: inputs.coverage.get(seedId) ?? '',
    });
  }
  const pairs: ReviewPair[] = [];
  for (const p of [sel.drawnPair, FIXED_PAIR].sort()) {
    const idx = Number(p.slice(1)) - 1;
    const src = inputs.pairs[idx];
    if (src === undefined) throw new Error(`pair ${p} missing`);
    const ids = { before: `${p}-before`, after: `${p}-after` };
    for (const side of ['before', 'after'] as const) {
      const report = inputs.pairReports.get(ids[side]);
      if (report === undefined) throw new Error(`no real-pairs report for ${ids[side]}`);
      trees.push({ treeId: ids[side], kind: side === 'before' ? 'pair-before' : 'pair-after', projectId: src.projectId, specPath: inputs.specOf(src.projectId), source: `../daedalus-realpairs/${ids[side]}`, firewallReport: report });
    }
    pairs.push({ pair: p, projectId: src.projectId, beforeTreeId: ids.before, afterTreeId: ids.after, note: src.researchNote ?? '', touchedFiles: src.touchedFiles.map((t) => ({ status: t.status, path: t.path, ...(t.from !== undefined ? { from: t.from } : {}) })) });
  }
  return {
    version: REVIEW_VERSION,
    adr: 'ADR-036',
    reading: 'exploratory',
    ...pins,
    selectionSeed: SELECTION_SEED,
    order: 'run-major: run 0 of every tree in plan order, then run 1, then run 2',
    treesRoot: `${REVIEW_ROOT}/trees`,
    trees,
    seeds,
    pairs,
  };
}

// --- tree export ---------------------------------------------------------------------------------------------------

function listFiles(root: string, rel = ''): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(path.join(root, rel)).sort()) {
    if (EXCLUDED_NAMES.has(name)) continue;
    const r = rel === '' ? name : `${rel}/${name}`;
    const st = fs.lstatSync(path.join(root, r));
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) out.push(...listFiles(root, r));
    else if (st.isFile()) out.push(r);
  }
  return out;
}

export function treeDigest(root: string): { digest: string; files: number } {
  const files = listFiles(root);
  const lines = files.map((f) => `${f}\t${sha256(fs.readFileSync(path.join(root, f)))}`);
  return { digest: sha256(lines.join('\n')), files: files.length };
}

function setMtimes(root: string): void {
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.lstatSync(p).isDirectory()) walk(p);
      fs.utimesSync(p, FIXED_MTIME, FIXED_MTIME);
    }
  };
  walk(root);
  fs.utimesSync(root, FIXED_MTIME, FIXED_MTIME);
}

/**
 * Exports one tree. A seeded tree is the copy's working tree. A baseline tree is the same copy with every edited file
 * restored from the copy's HEAD (the prepared base commit) and every created file removed, so the two trees differ by
 * the seed only. A pair tree is the `git archive` export of the pair commit. Excluded: `.git`, the mutant marker,
 * `node_modules`, `dist`, `coverage`, symbolic links.
 */
export function exportTree(repoRoot: string, tree: ReviewTree, seed: ReviewSeed | undefined, dest: string): void {
  const src = path.resolve(repoRoot, tree.source);
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  for (const f of listFiles(src)) {
    const to = path.join(dest, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(src, f), to);
  }
  if (tree.kind === 'baseline') {
    if (seed === undefined) throw new Error(`baseline ${tree.treeId} without its seed`);
    for (const f of seed.createdFiles) fs.rmSync(path.join(dest, f), { force: true });
    for (const f of seed.editedFiles) {
      const original = execFileSync('git', ['-C', src, 'show', `HEAD:${f}`], { maxBuffer: 64 * 1024 * 1024 });
      fs.writeFileSync(path.join(dest, f), original);
    }
  }
  setMtimes(dest);
}

// --- prose rendering of the spec -----------------------------------------------------------------------------------

/** One sentence per template name: what a violation is (from the AoC function table and the Cypher templates). */
export const RULE_PROSE: Readonly<Record<string, string>> = {
  'dependency-direction': 'A file of a layer must not import a file of a layer listed after it in the layer list above.',
  'no-cyclic-deps': 'Files must not form an import cycle (a chain of imports that leads back to its first file).',
  'no-layer-skip': 'The only import allowed between two different layers is from a layer to the layer listed directly before it; any other cross-layer import is a violation.',
  'no-domain-outward-dep': 'A file of a domain-kind layer must not import a file of any other layer.',
  'domain-purity': 'A file of a domain-kind layer must not import any of these packages: {forbidden_imports}.',
  'dependency-inversion': 'In an application-kind layer, at least {threshold} of the constructor-injected dependencies of a class must be interfaces or abstract types, not concrete classes.',
  'repository-pattern': 'A repository class (name containing Repository or Repo) in an infrastructure-kind layer must implement an interface.',
  'use-case-isolation': 'A use-case class of an application-kind layer must inject only types of the domain-kind and application-kind layers.',
  'controller-no-entity': 'A controller class must not reach a domain entity class within two import or injection steps.',
  'domain-state-purity': 'A class of a domain-kind layer must not hold an infrastructure-layer type in a field or through constructor injection.',
  'domain-stability': 'A file of a domain-kind layer must have instability (outgoing / (incoming + outgoing) imports to and from other layers) of at most {threshold}.',
  'module-fan-out': 'A file must not import more than {threshold} distinct project files.',
  'component-instability': 'A layer-mapped file must have instability (outgoing / (incoming + outgoing) imports) of at most {threshold}.',
  'no-orphan-files': 'Every layer-mapped file that is not an index barrel must import, re-export or be imported by at least one other project file.',
  'max-fan-in': 'A file must not be imported by more than {threshold} distinct project files.',
  'abstraction-ratio': 'The share of interfaces among the classes and interfaces must be at least {threshold}.',
  'single-responsibility-proxy': 'A class must declare at most {max_public_methods} methods and inject at most {max_dependencies} constructor dependencies.',
  'interface-segregation-proxy': 'An interface must declare at most {max_interface_methods} methods.',
  'inheritance-depth': 'A class must not sit more than {max_depth} levels deep in an extends chain.',
  'naming-conventions': 'Class names must follow the naming pattern of their layer.',
  'naming-services': 'A service or use-case class (name containing Service or UseCase) of an application-kind layer must have a name matching {pattern}.',
  'naming-repos': 'A repository class (name containing Repository or Repo) must have a name matching {pattern}.',
  'naming-controllers': 'A controller class must have a name matching {pattern}.',
  'test-file-pairing': 'Every layer-mapped source file that is not an index barrel must have a sibling test file (same name with .spec.ts or .test.ts).',
  'no-index-logic': 'An index.ts barrel file must only re-export; it must not declare classes, functions or variables.',
};

interface SpecFunction { readonly id: string; readonly name: string; readonly dimension: string; readonly severity?: string; readonly route?: string; readonly enabled?: boolean; readonly exclude_paths?: readonly string[]; readonly semantic_criteria?: { readonly rule?: string; readonly rubric?: { readonly fail?: string } }; readonly [k: string]: unknown }
interface SpecLayer { readonly name: string; readonly kind?: string; readonly directories?: readonly string[]; readonly file_patterns?: readonly string[] }

function fill(template: string, f: SpecFunction): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = f[key];
    if (Array.isArray(v)) return v.map(String).join(', ');
    if (v === undefined) return key === 'threshold' ? DEFAULT_THRESHOLDS[f.name] ?? 'the default' : key;
    return String(v);
  });
}

const DEFAULT_THRESHOLDS: Readonly<Record<string, string>> = { 'component-instability': '0.8' };

/**
 * Renders the spec as prose. Listed rules: the symbolic functions the firewall executed on the same tree (a row in its
 * report's `functionResults`), in spec order, except those of severity `advisory` (ADR-036 item 2: FF-CV05, FF-CV06,
 * FF-C06 are per-file inventories, not left out for any seed), and the enabled neuronal functions (rule and fail rubric).
 */
export function renderSpecProse(specText: string, executed: ReadonlySet<string>): { prose: string; ruleIds: string[] } {
  const spec = parseYaml(specText) as { architecture?: { style?: string; layers?: SpecLayer[]; default_exclude_paths?: string[] }; fitness_functions?: SpecFunction[] };
  const layers = spec.architecture?.layers ?? [];
  const lines: string[] = [];
  lines.push(`Architecture style: ${spec.architecture?.style ?? 'unspecified'}.`);
  lines.push('');
  lines.push('Layers, in this order (a file belongs to the first layer whose directories match it, else to the first layer whose file patterns match it; a file that matches no layer is unmapped, and layer rules do not apply to it):');
  layers.forEach((l, i) => {
    const parts = [`${String(i + 1)}. ${l.name} (kind: ${l.kind ?? l.name})`];
    if ((l.directories ?? []).length > 0) parts.push(`directories ${(l.directories ?? []).join(', ')}`);
    if ((l.file_patterns ?? []).length > 0) parts.push(`file patterns ${(l.file_patterns ?? []).join(', ')}`);
    lines.push(parts.join('; '));
  });
  const ex = spec.architecture?.default_exclude_paths ?? [];
  if (ex.length > 0) lines.push(`Files under ${ex.join(', ')} are not part of the evaluated code.`);
  lines.push('');
  lines.push('Rules (each rule has an id; a violation is a file that breaks the rule):');
  const ruleIds: string[] = [];
  for (const f of spec.fitness_functions ?? []) {
    if (f.enabled === false || f.severity === 'advisory') continue;
    const neural = f.route === 'neuronal';
    if (!neural && !executed.has(f.id)) continue;
    let text: string;
    if (neural) {
      text = `${f.semantic_criteria?.rule ?? ''} A violation: ${f.semantic_criteria?.rubric?.fail ?? ''}`.trim();
    } else {
      const t = RULE_PROSE[f.name];
      if (t === undefined) throw new Error(`LLM_REVIEW_RULE_PROSE_MISSING: ${f.name}`);
      text = fill(t, f);
    }
    const exclude = (f.exclude_paths ?? []).length > 0 ? ` Files under ${(f.exclude_paths ?? []).join(', ')} are exempt from this rule.` : '';
    lines.push(`- ${f.id} (${f.name}, ${f.dimension}): ${text}${exclude}`);
    ruleIds.push(f.id);
  }
  return { prose: lines.join('\n'), ruleIds };
}

export function renderPrompt(template: string, prose: string): string {
  if (!template.includes('{{ARCHITECTURE}}')) throw new Error('prompt template has no {{ARCHITECTURE}} placeholder');
  return template.replace('{{ARCHITECTURE}}', prose);
}

// --- Codex call ----------------------------------------------------------------------------------------------------

export const REVIEW_PROFILE = 'daedalus_review';

/** The read-only profile: reads anywhere except the denied paths; no write; no network. */
export function reviewPermissionsToml(denies: readonly string[]): string {
  const fsEntries = denies.map((p) => `${JSON.stringify(p)}="deny"`);
  return `permissions={${REVIEW_PROFILE}={extends=":read-only", filesystem={${fsEntries.join(', ')}}, network={enabled=false}}}`;
}

export function buildReviewArgs(plan: Pick<ReviewPlan, 'model' | 'reasoningEffort'>, modelCatalog: string, schemaFile: string, cwd: string, denies: readonly string[]): string[] {
  const args = [
    'exec', '--json', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules',
    '-m', plan.model, '-C', cwd,
    '-c', `model_catalog_json=${JSON.stringify(modelCatalog)}`,
    '-c', `model_reasoning_effort=${JSON.stringify(plan.reasoningEffort)}`,
    '-c', 'approval_policy="never"',
    '-c', 'project_doc_max_bytes=0',
    '-c', 'project_root_markers=[]',
    '-c', 'skills.include_instructions=false',
    '-c', 'skills.bundled.enabled=false',
    '-c', 'include_apps_instructions=false',
    '-c', 'web_search="disabled"',
    '-c', 'check_for_update_on_startup=false',
    '-c', 'history.persistence="none"',
    '-c', 'shell_environment_policy.inherit="core"',
    '-c', reviewPermissionsToml(denies),
    '-c', `default_permissions=${JSON.stringify(REVIEW_PROFILE)}`,
    '--output-schema', schemaFile,
  ];
  for (const f of CODEX_DISABLED_FEATURES) args.push('--disable', f);
  args.push('-');
  return args;
}

export interface TokenUsage { readonly input: number; readonly cached: number; readonly output: number; readonly reasoning: number }

/** Last cumulative `token_count` of a rollout. */
export function rolloutTokens(rollout: readonly Json[] | null): TokenUsage | null {
  if (rollout === null) return null;
  let last: Json | null = null;
  for (const r of rollout) {
    const p = (r.payload ?? r) as Json;
    if (p.type === 'token_count' && typeof p.info === 'object' && p.info !== null) {
      const t = (p.info as Json).total_token_usage as Json | undefined;
      if (t !== undefined) last = t;
    }
  }
  if (last === null) return null;
  const n = (k: string): number => (typeof last?.[k] === 'number' ? (last[k] as number) : 0);
  return { input: n('input_tokens'), cached: n('cached_input_tokens'), output: n('output_tokens'), reasoning: n('reasoning_output_tokens') };
}

export function rateCardCredits(t: TokenUsage): number {
  return ((t.input - t.cached) * RATE_CARD.input + t.cached * RATE_CARD.cached + t.output * RATE_CARD.output) / 1e6;
}

/** Served models from the rollout's turn contexts. */
export function servedModels(rollout: readonly Json[] | null): string[] {
  const out = new Set<string>();
  for (const r of rollout ?? []) {
    const p = (r.payload ?? r) as Json;
    if (r.type === 'turn_context' && typeof p.model === 'string') out.add(p.model);
  }
  return [...out].sort();
}

export interface ReviewFinding { readonly file: string; readonly rule: string; readonly reason: string }

export function parseReviewOutput(text: string | null | undefined): ReviewFinding[] | null {
  if (typeof text !== 'string') return null;
  try {
    const v = JSON.parse(text) as { violations?: unknown };
    if (!Array.isArray(v.violations)) return null;
    const out: ReviewFinding[] = [];
    for (const x of v.violations) {
      if (typeof x !== 'object' || x === null) return null;
      const o = x as Json;
      if (typeof o.file !== 'string' || typeof o.rule !== 'string' || typeof o.reason !== 'string') return null;
      out.push({ file: o.file, rule: o.rule, reason: o.reason });
    }
    return out;
  } catch {
    return null;
  }
}

export interface Cassette {
  readonly schemaVersion: 1;
  readonly treeId: string;
  readonly run: number;
  readonly attempt: number;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly promptSha256: string;
  readonly treeDigest: string;
  readonly cliVersion: string;
  readonly model: string;
  readonly servedModels: readonly string[];
  readonly reroutes: unknown;
  readonly exitCode: number;
  readonly timedOut: boolean;
  readonly isError: boolean;
  readonly subtype: string;
  readonly valid: boolean;
  readonly invalidReason?: string;
  readonly findings: readonly ReviewFinding[] | null;
  readonly tokens: TokenUsage | null;
  readonly creditsRateCard: number | null;
  readonly balanceAfter: string | null;
  readonly toolCalls: number;
  readonly permissionDenials: number;
  readonly envelopeSha256: string;
  readonly discardedAttempts: readonly { readonly attempt: number; readonly reason: string; readonly creditsRateCard: number | null }[];
}

export function cassettePath(repoRoot: string, treeId: string, run: number): string {
  return path.join(repoRoot, CASSETTE_DIR, treeId, `run-${String(run)}.json`);
}

/** Calls in the registered order: run-major, trees in plan order. */
export function callOrder(plan: Pick<ReviewPlan, 'trees' | 'runs'>): { treeId: string; run: number }[] {
  const out: { treeId: string; run: number }[] = [];
  for (let run = 0; run < plan.runs; run++) for (const t of plan.trees) out.push({ treeId: t.treeId, run });
  return out;
}

/**
 * Budget stop (ADR-036 item 5): before a call, the projected cost is the tree's own first valid call × 1.5 when the
 * tree has one, else the largest call so far (the plan's first-call estimate before any call). The call is made only
 * when spent + projected ≤ budget; otherwise the run stops (`LLM_REVIEW_BUDGET_STOP`) and no later call is made.
 */
export function projectedCost(spentByTree: ReadonlyMap<string, readonly number[]>, treeId: string, firstEstimate: number): number {
  const own = spentByTree.get(treeId);
  if (own !== undefined && own.length > 0) return (own[0] as number) * 1.5;
  let max = 0;
  for (const v of spentByTree.values()) for (const c of v) max = Math.max(max, c);
  return max > 0 ? max : firstEstimate;
}

export interface RunDeps {
  readonly repoRoot: string;
  readonly codexBinary: string;
  readonly codexHome: string;
  readonly userHome: string;
  readonly realHome: string;
  readonly out: (t: string) => void;
  readonly sleep: (ms: number) => Promise<void>;
}

export async function callOnce(deps: RunDeps, plan: Pick<ReviewPlan, 'treesRoot' | 'model' | 'reasoningEffort' | 'modelCatalog' | 'timeoutMs'>, tree: Pick<ReviewTree, 'treeId'>, prompt: string): Promise<{ cli: ProcessResult | null; envelope: Json | null; rollout: readonly Json[] | null; usageLimit: number | null }> {
  const home = checkCodexHome(deps.codexHome);
  if (!home.success) throw new Error(`LLM_REVIEW_CODEX_HOME: ${JSON.stringify(home.errors)}`);
  const cwd = path.resolve(deps.repoRoot, plan.treesRoot, tree.treeId);
  const denies = codexReadDenies(
    { outputRoot: path.resolve(deps.repoRoot, plan.treesRoot), harnessRoot: path.join(cwd, '.none'), codexHome: deps.codexHome, realHome: deps.realHome },
    cwd,
    path.dirname(path.resolve(deps.repoRoot)),
  );
  const args = buildReviewArgs(plan, path.resolve(deps.repoRoot, plan.modelCatalog), path.resolve(deps.repoRoot, OUTPUT_SCHEMA), cwd, denies);
  const env = buildCodexChildEnv(process.env, { codexHome: deps.codexHome, userHome: deps.userHome });
  const runner = new NodeProcessRunner();
  const call = await runner.run(deps.codexBinary, args, { cwd, env, stdin: prompt, timeoutMs: plan.timeoutMs, maxOutputBytes: 64 * 1024 * 1024 });
  const cli = call.success ? call.data : null;
  if (cli === null) return { cli, envelope: null, rollout: null, usageLimit: null };
  const first = parseCodexRun(cli.stdout, null, []);
  const rollout = takeRollout(deps.codexHome, first.success ? first.data.summary.sessionId : undefined);
  const parsed = parseCodexRun(cli.stdout, rollout, []);
  const envelope = parsed.success ? (parsed.data.scrubbed as Json) : null;
  const limit = codexUsageLimit(cli, parsed.success ? parsed.data : null);
  const reset = limit !== null ? rateLimitResetAt(rollout !== null ? lastRateLimits(rollout) : undefined) : undefined;
  return { cli, envelope, rollout, usageLimit: limit === null ? null : reset ?? Date.now() + 30 * 60_000 };
}

export async function runReview(deps: RunDeps, plan: ReviewPlan, prompts: ReadonlyMap<string, string>, only?: { treeId: string; run: number }): Promise<number> {
  const ver = execFileSync(deps.codexBinary, ['--version'], { env: buildCodexChildEnv(process.env, { codexHome: deps.codexHome, userHome: deps.userHome }) }).toString();
  if (parseCodexVersion(ver) !== plan.cliVersion) throw new Error(`LLM_REVIEW_CLI_VERSION: ${ver.trim()} != ${plan.cliVersion}`);
  if (sha256(fs.readFileSync(path.resolve(deps.repoRoot, plan.modelCatalog))) !== plan.modelCatalogSha256) throw new Error('LLM_REVIEW_CATALOG_HASH');
  const spent = new Map<string, number[]>();
  let total = 0;
  for (const { treeId, run } of callOrder(plan)) {
    const file = cassettePath(deps.repoRoot, treeId, run);
    if (fs.existsSync(file)) {
      const c = readJson<Cassette>(file);
      const cost = (c.creditsRateCard ?? 0) + c.discardedAttempts.reduce((s, d) => s + (d.creditsRateCard ?? 0), 0);
      total += cost;
      spent.set(treeId, [...(spent.get(treeId) ?? []), cost]);
      continue;
    }
    if (only !== undefined && (only.treeId !== treeId || only.run !== run)) continue;
    const projected = projectedCost(spent, treeId, plan.firstCallEstimateCredits);
    if (total + projected > plan.budgetCredits) {
      deps.out(`LLM_REVIEW_BUDGET_STOP before ${treeId} run ${String(run)}: spent ${total.toFixed(2)} + projected ${projected.toFixed(2)} > ${String(plan.budgetCredits)}\n`);
      return 3;
    }
    const tree = plan.trees.find((t) => t.treeId === treeId);
    if (tree === undefined || tree.digest === undefined) throw new Error(`tree ${treeId} not pinned`);
    const cwd = path.resolve(deps.repoRoot, plan.treesRoot, treeId);
    const d = treeDigest(cwd);
    if (d.digest !== tree.digest) throw new Error(`LLM_REVIEW_TREE_CHANGED: ${treeId}`);
    const prompt = prompts.get(treeId);
    if (prompt === undefined) throw new Error(`no prompt for ${treeId}`);
    if (tree.promptSha256 !== sha256(prompt)) throw new Error(`LLM_REVIEW_PROMPT_CHANGED: ${treeId}`);
    const discarded: { attempt: number; reason: string; creditsRateCard: number | null }[] = [];
    let attempt = 0;
    for (;;) {
      const startedAt = new Date().toISOString();
      const t0 = Date.now();
      const r = await callOnce(deps, plan, tree, prompt);
      const tokens = rolloutTokens(r.rollout);
      const credits = tokens === null ? null : rateCardCredits(tokens);
      if (r.usageLimit !== null) {
        const wait = Math.max(60_000, r.usageLimit - Date.now());
        deps.out(`usage limit at ${treeId} run ${String(run)}; pausing ${String(Math.round(wait / 60000))} min (registered pause, not an attempt)\n`);
        if (credits !== null) total += credits;
        await deps.sleep(wait);
        continue;
      }
      const env = r.envelope;
      const findings = parseReviewOutput(typeof env?.result === 'string' ? env.result : null);
      const isError = env === null || env.is_error === true;
      const invalidReason = r.cli === null ? 'spawn-failed' : r.cli.timedOut ? 'timeout' : isError ? `error:${String(env?.subtype ?? 'envelope-unreadable')}` : findings === null ? 'output-unparsable' : undefined;
      if (invalidReason !== undefined && attempt === 0) {
        discarded.push({ attempt, reason: invalidReason, creditsRateCard: credits });
        if (credits !== null) total += credits;
        attempt++;
        continue;
      }
      const envText = JSON.stringify(env ?? {});
      const envFile = path.resolve(deps.repoRoot, REVIEW_ROOT, 'envelopes', treeId, `run-${String(run)}.json`);
      writeFile(envFile, envText);
      const rl = r.rollout !== null ? (lastRateLimits(r.rollout) as Json | undefined) : undefined;
      const credit = rl?.credits as Json | undefined;
      const cassette: Cassette = {
        schemaVersion: 1,
        treeId,
        run,
        attempt,
        startedAt,
        durationMs: Date.now() - t0,
        promptSha256: sha256(prompt),
        treeDigest: d.digest,
        cliVersion: plan.cliVersion,
        model: plan.model,
        servedModels: servedModels(r.rollout),
        reroutes: env?.reroutes ?? [],
        exitCode: r.cli?.exitCode ?? -1,
        timedOut: r.cli?.timedOut ?? false,
        isError,
        subtype: String(env?.subtype ?? ''),
        valid: invalidReason === undefined && servedModels(r.rollout).every((m) => m === plan.model),
        ...(invalidReason !== undefined ? { invalidReason } : servedModels(r.rollout).every((m) => m === plan.model) ? {} : { invalidReason: 'model-mismatch' }),
        findings,
        tokens,
        creditsRateCard: credits,
        balanceAfter: typeof credit?.balance === 'string' ? credit.balance : null,
        toolCalls: typeof env?.num_turns === 'number' ? env.num_turns : 0,
        permissionDenials: Array.isArray(env?.permission_denials) ? env.permission_denials.length : 0,
        envelopeSha256: sha256(envText),
        discardedAttempts: discarded,
      };
      writeFile(file, `${JSON.stringify(cassette, null, 2)}\n`);
      const cost = (credits ?? 0) + discarded.reduce((s, x) => s + (x.creditsRateCard ?? 0), 0);
      total += credits ?? 0;
      spent.set(treeId, [...(spent.get(treeId) ?? []), cost]);
      deps.out(`${treeId} run ${String(run)}: ${cassette.valid ? 'valid' : `invalid (${cassette.invalidReason ?? ''})`}, ${String(findings?.length ?? 0)} findings, ${(credits ?? 0).toFixed(2)} credits, total ${total.toFixed(2)}, balance ${cassette.balanceAfter ?? '?'}\n`);
      break;
    }
  }
  return 0;
}

// --- scoring (no model call) ---------------------------------------------------------------------------------------

/** File normalisation: posix, no leading `./` or `/`, a project-root absolute prefix removed. */
export function normFile(file: string, treeRoot?: string): string {
  let f = file.replace(/\\/g, '/').trim();
  if (treeRoot !== undefined) {
    const root = treeRoot.replace(/\\/g, '/').replace(/\/$/, '');
    if (f.startsWith(`${root}/`)) f = f.slice(root.length + 1);
  }
  f = f.replace(/^\.\//, '').replace(/^\/+/, '');
  f = f.replace(/:\d+(?::\d+)?$/, '');
  return f;
}

export function keyOf(rule: string, file: string): string {
  return JSON.stringify([rule.trim().toUpperCase(), file]);
}

export function keySet(findings: readonly ReviewFinding[], treeRoot?: string): Set<string> {
  return new Set(findings.map((f) => keyOf(f.rule, normFile(f.file, treeRoot))));
}

function parseKey(k: string): [string, string] {
  return JSON.parse(k) as [string, string];
}

/**
 * Seed detection in one run (ADR-036 item 4; MAT-02..04 adapted to the key (rule, file)):
 * - `primary`: a key of the seeded run whose rule is an applicable expected function and whose file is the file of
 *   one of that function's expected keys, and that the baseline run of the same index does not report (MAT-03
 *   difference by run index);
 * - `presence`: the same without the baseline difference;
 * - `family`: the rule's dimension equals the seed's dimension (any rule of that family), with the difference.
 */
export function detectSeed(seed: ReviewSeed, seeded: ReadonlySet<string>, baseline: ReadonlySet<string> | null, dimensionOf: (rule: string) => string | undefined): { primary: boolean; presence: boolean; family: boolean } {
  const files = new Set(seed.keys.map((k) => k.filePath));
  let primary = false;
  let presence = false;
  let family = false;
  for (const k of seeded) {
    const [rule, file] = parseKey(k);
    if (!files.has(file)) continue;
    const fileKeys = seed.keys.filter((x) => x.filePath === file).map((x) => x.functionId);
    const exact = seed.functionIds.includes(rule) && fileKeys.includes(rule);
    const isNew = baseline === null || !baseline.has(k);
    if (exact) presence = true;
    if (exact && isNew) primary = true;
    if (dimensionOf(rule) === seed.dimension && isNew) family = true;
  }
  return { primary, presence, family };
}

/** ADR-030 §13.3 rule on (rule, file) keys; renamed files mapped to their new path. */
export function scorePairRun(before: ReadonlySet<string>, after: ReadonlySet<string>, touched: readonly TouchedFile[]): { beforeOnTouched: number; afterOnTouched: number; resolved: string[]; detects: boolean; strict: boolean } {
  const oldPaths = new Set(touched.map((t) => t.from ?? t.path));
  const newPaths = new Set(touched.filter((t) => t.status !== 'D').map((t) => t.path));
  const rename = new Map(touched.filter((t) => t.from !== undefined).map((t) => [t.from as string, t.path]));
  const onBefore = [...before].filter((k) => oldPaths.has(parseKey(k)[1]));
  const onAfter = [...after].filter((k) => newPaths.has(parseKey(k)[1]));
  const resolved = onBefore.filter((k) => {
    const [rule, file] = parseKey(k);
    return !after.has(keyOf(rule, rename.get(file) ?? file));
  });
  return { beforeOnTouched: onBefore.length, afterOnTouched: onAfter.length, resolved: resolved.sort(), detects: resolved.length > 0, strict: onBefore.length > 0 && onAfter.length === 0 };
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number | null {
  const union = new Set([...a, ...b]);
  if (union.size === 0) return null;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / union.size;
}

interface DaViolation { readonly functionId: string; readonly filePath: string; readonly route?: string }

function firewallKeys(report: { violations?: readonly DaViolation[] }): { keys: Set<string>; files: Set<string> } {
  const keys = new Set<string>();
  const files = new Set<string>();
  for (const v of report.violations ?? []) {
    if (v.route !== undefined && v.route !== 'symbolic') continue;
    keys.add(keyOf(v.functionId, v.filePath));
    files.add(v.filePath);
  }
  return { keys, files };
}

function mean(xs: readonly number[]): number | null {
  return xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length;
}

function r6(x: number | null): string {
  return x === null ? '' : x.toFixed(6);
}

export function scoreReview(repoRoot: string, plan: ReviewPlan, outDir: string): Json {
  const cassettes = new Map<string, Cassette>();
  for (const t of plan.trees) for (let run = 0; run < plan.runs; run++) {
    const f = cassettePath(repoRoot, t.treeId, run);
    if (fs.existsSync(f)) cassettes.set(`${t.treeId}#${String(run)}`, readJson<Cassette>(f));
  }
  const treeRoot = (t: ReviewTree): string => path.resolve(repoRoot, plan.treesRoot, t.treeId);
  const validKeys = (treeId: string, run: number): Set<string> | null => {
    const c = cassettes.get(`${treeId}#${String(run)}`);
    const t = plan.trees.find((x) => x.treeId === treeId);
    if (c === undefined || !c.valid || c.findings === null || t === undefined) return null;
    return keySet(c.findings, treeRoot(t));
  };
  const dims = new Map<string, string>();
  for (const t of plan.trees) {
    const spec = parseYaml(fs.readFileSync(path.join(repoRoot, t.specPath), 'utf8')) as { fitness_functions?: SpecFunction[] };
    for (const f of spec.fitness_functions ?? []) dims.set(f.id, f.dimension);
  }
  const dimensionOf = (rule: string): string | undefined => dims.get(rule);

  // seeds
  const seedRows: Json[] = [];
  const perRun = { primary: 0, presence: 0, family: 0, n: 0 };
  for (const s of plan.seeds) {
    let p = 0, pr = 0, fam = 0, n = 0;
    for (let run = 0; run < plan.runs; run++) {
      const seeded = validKeys(s.treeId, run);
      const base = validKeys(s.baselineTreeId, run);
      if (seeded === null || base === null) continue;
      const d = detectSeed(s, seeded, base, dimensionOf);
      n++;
      if (d.primary) p++;
      if (d.presence) pr++;
      if (d.family) fam++;
    }
    perRun.primary += p; perRun.presence += pr; perRun.family += fam; perRun.n += n;
    seedRows.push({ seed_id: s.seedId, operator_id: s.operatorId, dimension: s.dimension, expected_functions: s.functionIds.join(' '), expected_files: [...new Set(s.keys.map((k) => k.filePath))].join(' '), scored_runs: n, detected_runs_primary: p, detected_runs_presence: pr, detected_runs_family: fam, firewall_so4_v2_status: s.firewallStatus });
  }
  const recallRows: Json[] = (['primary', 'presence', 'family'] as const).map((reading) => {
    const k = perRun[reading];
    const [lo, hi] = perRun.n > 0 ? wilson(k, perRun.n) : [null, null];
    return { reading, detected_seed_runs: k, seed_runs: perRun.n, recall: perRun.n > 0 ? r6(k / perRun.n) : '', ci_low: lo === null ? '' : r6(lo), ci_high: hi === null ? '' : r6(hi), ci_method: 'wilson-seed-runs-if-independent', firewall_detected: plan.seeds.filter((s) => s.firewallStatus === 'matched').length, firewall_seeds: plan.seeds.length };
  });

  // pairs
  const pairRows: Json[] = [];
  const pairRunRows: Json[] = [];
  const firewallPairs = csvRows(fs.readFileSync(path.join(repoRoot, 'results/real-pairs/pairs.csv'), 'utf8'));
  for (const p of plan.pairs) {
    let det = 0, strict = 0, n = 0;
    for (let run = 0; run < plan.runs; run++) {
      const b = validKeys(p.beforeTreeId, run);
      const a = validKeys(p.afterTreeId, run);
      if (b === null || a === null) continue;
      const o = scorePairRun(b, a, p.touchedFiles);
      n++;
      if (o.detects) det++;
      if (o.strict) strict++;
      pairRunRows.push({ pair: p.pair, run, before_on_touched: o.beforeOnTouched, after_on_touched: o.afterOnTouched, resolved: o.resolved.length, resolved_keys: o.resolved.map((k) => parseKey(k).join(':')).join(' '), detects: o.detects ? 1 : 0, detects_strict: o.strict ? 1 : 0 });
    }
    // chance control: the same rule between two different runs of the unchanged before tree
    let ctrl = 0, ctrlN = 0;
    for (let i = 0; i < plan.runs; i++) for (let j = 0; j < plan.runs; j++) {
      if (i === j) continue;
      const x = validKeys(p.beforeTreeId, i);
      const y = validKeys(p.beforeTreeId, j);
      if (x === null || y === null) continue;
      ctrlN++;
      if (scorePairRun(x, y, p.touchedFiles.map((t) => ({ status: 'M', path: t.from ?? t.path }))).detects) ctrl++;
    }
    const fw = (tool: string): string => firewallPairs.find((r) => r.pair === p.pair && r.tool === tool)?.detects ?? '';
    pairRows.push({ pair: p.pair, project_id: p.projectId, note: p.note, scored_runs: n, detects_runs: det, detects_strict_runs: strict, chance_control_detects: ctrl, chance_control_pairs: ctrlN, firewall_da_symbolic_all: fw('da-symbolic-all'), firewall_depcruise: fw('depcruise') });
  }

  // consistency
  const consistencyRows: Json[] = [];
  for (const t of plan.trees) {
    const sets: Set<string>[] = [];
    for (let run = 0; run < plan.runs; run++) {
      const k = validKeys(t.treeId, run);
      if (k !== null) sets.push(k);
    }
    const js: number[] = [];
    for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
      const v = jaccard(sets[i] as Set<string>, sets[j] as Set<string>);
      if (v !== null) js.push(v);
    }
    const union = new Set(sets.flatMap((s) => [...s]));
    const inAll = [...union].filter((k) => sets.every((s) => s.has(k))).length;
    consistencyRows.push({ tree_id: t.treeId, kind: t.kind, valid_runs: sets.length, findings_per_run: sets.map((s) => s.size).join(' '), mean_pairwise_jaccard: r6(mean(js)), union_keys: union.size, keys_in_every_run: inAll, share_in_every_run: union.size > 0 && sets.length > 1 ? r6(inAll / union.size) : '' });
  }

  // overlap with the firewall
  const overlapRows: Json[] = [];
  const tot = { exact: 0, sameFile: 0, none: 0, nonSymbolic: 0, fwKeys: 0, fwFound: 0 };
  for (const t of plan.trees) {
    const report = readJson<{ violations?: DaViolation[]; functionResults?: { functionId: string }[] }>(path.join(repoRoot, t.firewallReport));
    const executedAll = new Set((report.functionResults ?? []).map((f) => f.functionId));
    const listed = new Set(renderSpecProse(fs.readFileSync(path.join(repoRoot, t.specPath), 'utf8'), executedAll).ruleIds);
    const executed = new Set([...executedAll].filter((f) => listed.has(f)));
    const fw = firewallKeys({ violations: (report.violations ?? []).filter((v) => executed.has(v.functionId)) });
    for (let run = 0; run < plan.runs; run++) {
      const k = validKeys(t.treeId, run);
      if (k === null) continue;
      let exact = 0, sameFile = 0, none = 0, nonSymbolic = 0;
      for (const key of k) {
        const [rule, file] = parseKey(key);
        if (!executed.has(rule)) nonSymbolic++;
        else if (fw.keys.has(key)) exact++;
        else if (fw.files.has(file)) sameFile++;
        else none++;
      }
      const found = [...fw.keys].filter((x) => k.has(x)).length;
      tot.exact += exact; tot.sameFile += sameFile; tot.none += none; tot.nonSymbolic += nonSymbolic; tot.fwKeys += fw.keys.size; tot.fwFound += found;
      overlapRows.push({ tree_id: t.treeId, run, llm_keys: k.size, exact_firewall_key: exact, same_file_other_rule: sameFile, no_firewall_finding_on_file: none, rule_not_symbolic_or_unknown: nonSymbolic, firewall_keys: fw.keys.size, firewall_keys_found_by_llm: found });
    }
  }

  // cost
  const costRows: Json[] = [];
  let credits = 0, discardedCredits = 0, calls = 0, valid = 0, ms = 0;
  for (const t of plan.trees) for (let run = 0; run < plan.runs; run++) {
    const c = cassettes.get(`${t.treeId}#${String(run)}`);
    if (c === undefined) {
      costRows.push({ tree_id: t.treeId, run, status: 'not-run' });
      continue;
    }
    const disc = c.discardedAttempts.reduce((s, d) => s + (d.creditsRateCard ?? 0), 0);
    credits += c.creditsRateCard ?? 0;
    discardedCredits += disc;
    calls += 1 + c.discardedAttempts.length;
    if (c.valid) valid++;
    ms += c.durationMs;
    costRows.push({ tree_id: t.treeId, run, status: c.valid ? 'valid' : `invalid:${c.invalidReason ?? ''}`, input_tokens: c.tokens?.input ?? '', cached_input_tokens: c.tokens?.cached ?? '', output_tokens: c.tokens?.output ?? '', credits_rate_card: r6(c.creditsRateCard), discarded_attempts: c.discardedAttempts.length, discarded_credits: r6(disc), balance_after: c.balanceAfter ?? '', duration_ms: c.durationMs, tool_calls: c.toolCalls, permission_denials: c.permissionDenials, served_models: c.servedModels.join(' ') });
  }

  fs.mkdirSync(outDir, { recursive: true });
  writeFile(path.join(outDir, 'seeds.csv'), toCsv(seedRows));
  writeFile(path.join(outDir, 'recall.csv'), toCsv(recallRows));
  writeFile(path.join(outDir, 'pairs.csv'), toCsv(pairRows));
  writeFile(path.join(outDir, 'pair-runs.csv'), toCsv(pairRunRows));
  writeFile(path.join(outDir, 'consistency.csv'), toCsv(consistencyRows));
  writeFile(path.join(outDir, 'overlap.csv'), toCsv(overlapRows));
  writeFile(path.join(outDir, 'cost.csv'), toCsv(costRows));
  const claims = tot.exact + tot.sameFile + tot.none + tot.nonSymbolic;
  const summary: Json = {
    adr: 'ADR-036',
    reading: 'exploratory',
    reviewVersion: plan.version,
    model: plan.model,
    recall: recallRows,
    pairs: pairRows,
    consistency: { meanPairwiseJaccard: mean(consistencyRows.map((r) => Number(r.mean_pairwise_jaccard)).filter((x) => Number.isFinite(x) && String(x) !== '')) },
    overlap: { llmClaims: claims, exactFirewallKey: tot.exact, sameFileOtherRule: tot.sameFile, noFirewallFindingOnFile: tot.none, ruleNotSymbolicOrUnknown: tot.nonSymbolic, firewallKeys: tot.fwKeys, firewallKeysFoundByLlm: tot.fwFound },
    cost: { calls, validRuns: valid, plannedRuns: plan.trees.length * plan.runs, creditsRateCard: credits, discardedCredits, creditsPerValidReview: valid > 0 ? (credits + discardedCredits) / valid : null, totalDurationMs: ms },
  };
  writeFile(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}
