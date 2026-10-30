/**
 * v1.5 final study scorer (zero calls: no model, no Neo4j, no network). Driver: `run-study.ts`. Design note §4 (logs and
 * attribution) and §7 step 6.
 *
 *   npx tsx experiments/v15-study/score-study.ts --results <outRoot> --input <input.json> [--node-modules <dir>] [--hub <dir>] [--out <dir>]
 *       [--study-set <manifest>] [--counted hx-i|hx-ii] [--require-delivery-audit]
 *
 * `--study-set` (the Hexagonal study, B9): the task set's manifest (`lib/study-set.ts`; default the trap-families one,
 * or the input's `studySet` when `make-input.ts` wrote one); each task's directory comes from it. With `--counted`, every
 * step also records its tree digest (the hub's format) and its symbolic findings new against the seed, the input of
 * the gate (b) check (`scripts/v1.5/hx-gate-b.ts`). Without these options the output is the first study's.
 *
 * For every session with a `session.json` (`<results>/sessions/<id>/`), on every step snapshot (`snap/step-00` = seed):
 * - the task's behaviour tests (`experiments/puzzle-01/tools/run-tests.ts`) and every oracle sub-goal (`oracle.ts`;
 *   every sub-goal of a study task is a trap sub-goal);
 * - the v1.5 rules (`runTree`, status `violation`) and the frozen file rules (`check_diff` on the whole tree, blocking
 *   tier), as CAL-01/HCAL score them. Every spec, overlay, allow or settings file the agent created or edited
 *   (`EVASION_PATTERNS`) is undone in the scored copy first (created: removed; edited: the seed's version), so it
 *   changes neither D_v15 nor D_frozen, and is reported per cell as an evasion candidate (count and paths);
 * - `D_v15`: the findings of the ADMITTED rules only (the constant below), as identities rule + file + subject;
 * - the frozen v1.4 instrument's D (Study 2b: `firewallEvaluator`, check-correct `correct` only, `driftRun` at edge
 *   grain, renames continue), with the seed as step 1, when `--node-modules` (the skeleton install) is given.
 * Per run: **D** (D_v15, pre-registration §1) = distinct admitted-rule identities present at step j and absent from the
 * seed and every earlier step, summed over the steps (renames ρ from `git diff -M50%` carried forward; null when a
 * step is unscored); **Y** = admitted-rule identities on the final step that are not on the seed; **trapFailed** = an oracle
 * sub-goal fails on the final step; **functional** = every test passes on the final step; the exploratory rows'
 * findings (new against the seed) separately. Arm `combined`: the hub's ledger, the final tree's gate keys, and the
 * attribution table of §4 (push only, pull only, both with order, unexposed), plus double reports, with no hand step.
 * Writes `<out>/scores.json` and `<out>/cells.json` (the analysis input of `scripts/v1.5/lib/final-study-analyse.ts`:
 * task, style, rep, arm, D, trapFailed, accepted, flagged; plus D_frozen, secondary 7), default `<results>/scores/`.
 * Absolute paths never reach the output.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext, parseArgs } from '../../src/mcp-server/context.js';
import { checkDiffTool } from '../../src/mcp-server/tools.js';
import { loadRules, runTree } from '../../src/v15-instrument/index.js';
import { checkConsistency } from '../../src/v15-instrument/consistency.js';
import { scorerJudgeFromEnv } from '../../src/v15-instrument/mirror-sem.js';
import { keyOf } from '../../src/v15-instrument/edit-gate/gate.js';
import { checkLayers } from '../../src/v15-instrument/edit-gate/layers.js';
import { attribute, type Attribution, type LedgerRow } from '../../src/v15-instrument/delivery/ledger.js';
import { renameMapBetween } from '../../scripts/lib/drift/git-rename.js';
import { fromBlockingFinding } from '../../scripts/lib/drift/identity.js';
import { driftRun, type StepInput } from '../../scripts/lib/drift/study2-d.js';
import { STUDY2_S2D01, type DriftParams, type IdFinding } from '../../scripts/lib/drift/types.js';
import { buildHarnessTsconfig } from '../../scripts/lib/generators/harness-tsconfig.js';
import { engineDeps, engineEnv, taggedEvaluator } from '../../scripts/lib/loop/engine-tee.js';
import { firewallEvaluator } from '../../scripts/lib/loop/evaluator.js';
import { checkFinding } from '../../scripts/v1.3/lib/labelling/correctness.js';
import { findingsOfReport } from '../../scripts/v1.3/lib/labelling/findings.js';
import { SourceFacts } from '../../scripts/v1.3/lib/labelling/source-facts.js';
import { loadSpecView } from '../../scripts/v1.3/lib/labelling/spec-facts.js';
import { frozenSpec } from '../cal-01/score.js';
import { auditVerdict, findingsAgreement, treeDigest, type AuditVerdict, type CheckRecord } from './lib/delivery-audit.js';
import { DEFAULT_STUDY_SET, loadStudySet } from './lib/study-set.js';
import { ADMITTED_DDD_ROWS, ADMITTED_HEX_ROWS, INSTRUMENT_ID, ROW_OVERRIDES, admittedRules, cypherRules, exploratoryRules, frozenRules, instrumentRuleHash, ruleMatches, type Style } from '../../src/v15-instrument/rule-set.js';

// ── The admitted rules (CAL-03 for DDD, HCAL-03 for Hexagonal). Fixed before any study call; the one rule list
// (`src/v15-instrument/rule-set.ts`) holds them, and the delivery hub delivers the same set (admitted + exploratory).
export { ADMITTED_DDD_ROWS, ADMITTED_HEX_ROWS, ROW_OVERRIDES, admittedRules, exploratoryRules };
export type { Style };
const matches = ruleMatches;

export interface Hit {
  readonly rule: string; readonly file: string; readonly subject: string; readonly line: number | null; readonly source: 'v15' | 'frozen';
  /** R-MIRROR2 only: the shape word its evidence starts with (`[literal] …` → `literal`); not part of the identity. */
  readonly shape?: string;
}

/** The shape word of an R-MIRROR2 finding's evidence (`r-mirror2-vendor-lexicon.cypher`, last line), else undefined. */
export const mirror2Shape = (rule: string, evidence: string | undefined): string | undefined => (rule === 'R-MIRROR2' ? /^\[([a-z-]+)\]/.exec(evidence ?? '')?.[1] : undefined);

// ── The Hexagonal study's counted list (DRAFT pre-registration `Docs/v1.5/hexagonal-study-preregistration.md` §1) ──
// Literal constants, outside the rules-frozen root. FF-S03 and FF-P02 are advisory (never counted); H06, H11-d,
// R-MIRROR and R-MIRROR-SEM are not counted. R-MIRROR2 is counted by shape word: option (i), the default, counts
// `literal` and `error` (sub-shapes a and b); option (ii) counts every shape (a registered exception). The choice is
// the author's (§10 decision box); `tests/unit/v15-study/delivery-audit.test.ts` pins both lists.
export const HX_COUNTED_RULES: readonly string[] = ['FF-P01', 'FF-P03', 'FF-S01', 'FF-S04', 'R-AXA', 'R-COREIO', 'R-ENTITY-OUT', 'R-H5', 'R-INJ', 'R-LOCATOR', 'R-TRANSPORT'];
export const HX_MIRROR2_SHAPES: Readonly<Record<'i' | 'ii', readonly string[] | 'all'>> = { i: ['literal', 'error'], ii: 'all' };
export type HxOption = 'i' | 'ii';
/** Is a hit counted in the Hexagonal study's D under option (i) or (ii)? */
export function hxCounted(h: Pick<Hit, 'rule' | 'shape'>, option: HxOption = 'i'): boolean {
  if (HX_COUNTED_RULES.includes(h.rule)) return true;
  if (h.rule !== 'R-MIRROR2') return false;
  const shapes = HX_MIRROR2_SHAPES[option];
  return shapes === 'all' || (h.shape !== undefined && shapes.includes(h.shape));
}
/** The rule IDs a counted mode can count (for the delivery check: each must be delivered). */
export const hxCountedRuleIds = (): string[] => [...HX_COUNTED_RULES, 'R-MIRROR2'].sort();
/** Identity of a finding (Study 2b's D unit at this grain): rule + file + subject; line shifts do not split it. */
export const identity = (h: Pick<Hit, 'rule' | 'file' | 'subject'>): string => `${h.rule}|${h.file}|${h.subject}`;

/** Identities of a step that a rule set counts. */
export function identitiesOf(hits: readonly Hit[], rules: readonly string[]): Set<string> {
  return new Set(hits.filter((h) => matches(h.rule, rules)).map(identity));
}
/** Identities of a step that a counted predicate keeps (the Hexagonal study's `hxCounted`). */
export const identitiesBy = (hits: readonly Hit[], keep: (h: Hit) => boolean): Set<string> => new Set(hits.filter(keep).map(identity));
/**
 * The v1.5 rules on one scored tree, with the session's seed (step-00) as the baseline (instrument v1.5.3): the same
 * baseline the delivery hub's checks take (the cell's seed copy), so a rule that reads a baseline (R-MIRROR2) scores
 * what the hub delivers. `tests/unit/v15-instrument/baseline-delivery.test.ts` holds hub == scorer on it. R-MIRROR-SEM
 * (v1.5.4) reads the model fact the hub's judge cached, by content hash, in replay (zero calls; `scorerJudgeFromEnv`).
 */
export function scoreTreeV15(tree: string, rules: Parameters<typeof runTree>[1], spec: string, scratch: string, seed: string): ReturnType<typeof runTree> {
  const j = scorerJudgeFromEnv();
  return runTree(tree, rules, { spec, scratch, baseline: path.resolve(seed), ...(j !== null ? { mirrorJudge: j } : {}) });
}

/** New identities against the seed. */
export const newAgainst = (now: ReadonlySet<string>, seed: ReadonlySet<string>): string[] => [...now].filter((k) => !seed.has(k)).sort();

/** The per-run primary outcome Y: admitted-rule identities new against the seed at the final step. */
export function outcomeY(seedHits: readonly Hit[], finalHits: readonly Hit[], style: Style): { Y: number; newIdentities: string[] } {
  const rules = admittedRules(style);
  const n = newAgainst(identitiesOf(finalHits, rules), identitiesOf(seedHits, rules));
  return { Y: n.length, newIdentities: n };
}

export interface SubGoal { readonly id: string; readonly pass: boolean; readonly evidence?: readonly string[] }
export interface TestsResult { readonly passed: number; readonly failed: number; readonly cases: readonly { name: string; ok: boolean }[] }
export const testsPass = (t: TestsResult | null): boolean => t !== null && t.failed === 0 && t.cases.length > 0;
export const trapFailed = (sg: readonly SubGoal[] | null): boolean | null => (sg === null || sg.length === 0 ? null : sg.some((g) => !g.pass));

// ── Attribution (design note §4) ───────────────────────────────────────────────────────────────────────────────

export interface PushLogLine { readonly seq?: number; readonly event?: string; readonly pushed?: readonly number[]; readonly resolved?: readonly number[] }

/** A push of a finding number already shown and not resolved since (the ledger keeps it at 0 by construction). */
export function doubleReports(push: readonly PushLogLine[], rows: readonly Pick<LedgerRow, 'number' | 'resolvedBy' | 'cameBack'>[]): number {
  const pushed = new Map<number, number>();
  const resolvedByPush = new Map<number, number>();
  for (const l of push) {
    for (const n of l.pushed ?? []) pushed.set(n, (pushed.get(n) ?? 0) + 1);
    for (const n of l.resolved ?? []) resolvedByPush.set(n, (resolvedByPush.get(n) ?? 0) + 1);
  }
  let d = 0;
  for (const [n, c] of pushed) {
    const row = rows.find((r) => r.number === n);
    const excused = row !== undefined && (row.resolvedBy === 'pull' || row.cameBack) ? 1 : 0;
    d += Math.max(0, c - 1 - (resolvedByPush.get(n) ?? 0) - excused);
  }
  return d;
}

export interface AttributionRow { readonly number: number; readonly rule: string; readonly file: string; readonly firstChannel: string; readonly pushExposures: number; readonly pullExposures: number; readonly onFinalTree: boolean; readonly attribution: Attribution | null }

export function attributionTable(rows: readonly LedgerRow[], finalKeys: ReadonlySet<string>): { rows: AttributionRow[]; counts: Record<string, number> } {
  const out = rows.map((r) => {
    const onFinal = finalKeys.has(r.key);
    return { number: r.number, rule: r.rule, file: r.file, firstChannel: r.first.channel, pushExposures: r.exposures.filter((e) => e.channel === 'push').length, pullExposures: r.exposures.filter((e) => e.channel === 'pull').length, onFinalTree: onFinal, attribution: attribute(r, onFinal) };
  });
  const counts: Record<string, number> = { 'push only': 0, 'pull only': 0, 'push first, then pull': 0, 'pull first, then push': 0, unexposed: 0, 'open on final tree': 0 };
  for (const r of out) counts[r.attribution ?? 'open on final tree'] = (counts[r.attribution ?? 'open on final tree'] ?? 0) + 1;
  return { rows: out, counts };
}

// ── Evasion candidates: spec, overlay, allow and settings files the agent created or edited ──────────────────────

/** Files whose creation or edit by the agent could switch a rule off; never honoured by the scorer. */
export const EVASION_PATTERNS: readonly RegExp[] = [
  /(^|\/)detect02[^/]*$/i, // the allowance overlay and any variant
  /(^|\/)[^/]*allow[^/]*\.(ya?ml|json)$/i, // any allow-list file
  /\.(ya?ml)$/i, // any spec-shaped file (the study seeds hold none; the spec is root-only)
  /(^|\/)\.claude\//, // agent settings
  /(^|\/)(architecture|daedalus)[^/]*\.(json|ya?ml)$/i,
];
export const isEvasionPath = (rel: string): boolean => EVASION_PATTERNS.some((r) => r.test(rel));

export interface EvasionCandidate { readonly path: string; readonly kind: 'created' | 'edited' }

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    const abs = path.join(dir, rel);
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (rel === '' && (e.name === 'node_modules' || e.name === '.git')) continue;
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else if (e.isFile()) out.push(r);
    }
  };
  if (fs.existsSync(dir)) walk('');
  return out.sort();
}

/** The evasion-pattern files of `tree` that are new or differ from `seed`. */
export function evasionCandidates(seed: string, tree: string): EvasionCandidate[] {
  const out: EvasionCandidate[] = [];
  for (const f of filesUnder(tree).filter(isEvasionPath)) {
    const s = path.join(seed, f);
    if (!fs.existsSync(s)) out.push({ path: f, kind: 'created' });
    else if (!fs.readFileSync(s).equals(fs.readFileSync(path.join(tree, f)))) out.push({ path: f, kind: 'edited' });
  }
  return out;
}

/** Undoes the candidates in a scoring copy: created files removed, edited files back to the seed's version. */
export function neutralise(tree: string, seed: string, cands: readonly EvasionCandidate[]): void {
  for (const c of cands) {
    if (c.kind === 'created') fs.rmSync(path.join(tree, c.path), { force: true });
    else fs.copyFileSync(path.join(seed, c.path), path.join(tree, c.path));
  }
}

// ── D_v15 over the steps (pre-registration §1) ───────────────────────────────────────────────────────────────

const renamed = (id: string, rho: ReadonlyMap<string, string>): string => {
  const [rule, file, ...rest] = id.split('|');
  const to = rho.get(file ?? '');
  return to === undefined ? id : [rule, to, ...rest].join('|');
};

/**
 * D: identities present at step j (1 ≤ j ≤ n) and absent from the seed and every earlier step, summed over j.
 * `ids[0]` is the seed; `rhos[j]` maps the file renames between step j-1 and step j (git diff -M50%), applied to the
 * prior union before comparing. A null step (unscored) makes D null.
 */
export function dOverSteps(ids: readonly (ReadonlySet<string> | null)[], rhos: readonly (ReadonlyMap<string, string> | undefined)[] = []): { D: number | null; perStep: number[] } {
  if (ids.length === 0 || ids.some((x) => x === null)) return { D: null, perStep: [] };
  let prior = new Set(ids[0] as ReadonlySet<string>);
  const perStep: number[] = [];
  for (let j = 1; j < ids.length; j++) {
    const rho = rhos[j];
    if (rho !== undefined && rho.size > 0) prior = new Set([...prior].map((x) => renamed(x, rho)));
    const now = ids[j] as ReadonlySet<string>;
    const fresh = [...now].filter((x) => !prior.has(x));
    perStep.push(fresh.length);
    for (const x of now) prior.add(x);
  }
  return { D: perStep.reduce((a, b) => a + b, 0), perStep };
}

/** One analysis cell (`scripts/v1.5/lib/final-study-analyse.ts` `Cell`, plus D_frozen). */
export interface AnalysisCell {
  readonly task: string; readonly style: Style; readonly rep: number; readonly arm: 'none' | 'combined';
  readonly D: number | null; readonly trapFailed: boolean | null; readonly accepted: boolean | null; readonly flagged: boolean;
  readonly D_frozen: number | null;
}

// ── I/O ────────────────────────────────────────────────────────────────────────────────────────────────────────

const REPO = process.cwd();
const FAM = 'experiments/trap-families';
const readLines = <T>(f: string): T[] => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as T) : []);

function tsxJson(args: string[]): Record<string, unknown> | null {
  const r = spawnSync(process.execPath, [path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
  const line = (r.stdout ?? '').trim().split('\n').filter((l) => l.startsWith('{')).at(-1);
  try { return line === undefined ? null : (JSON.parse(line) as Record<string, unknown>); } catch { return null; }
}

function copyTree(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) copyTree(a, b);
    else if (e.isFile()) fs.copyFileSync(a, b);
  }
}

/** The frozen file rules on the whole tree (CAL-01's `frozenHits`, with the subject kept for the identity). */
async function frozenFileHits(root: string, spec: string, scratch: string): Promise<Hit[]> {
  const fspec = frozenSpec(spec, path.join(scratch, `${path.basename(root)}.frozen.yaml`));
  const files = execFileSync('find', ['src', '-name', '*.ts'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const diff = files.map((f) => {
    const body = fs.readFileSync(path.join(root, f), 'utf8').split('\n');
    return `--- /dev/null\n+++ b/${f}\n@@ -0,0 +1,${String(body.length)} @@\n${body.map((l) => `+${l}`).join('\n')}\n`;
  }).join('');
  if (diff === '') return [];
  const ctx = buildContext(parseArgs(['--spec', fspec, '--project', root, '--engine', 'cypher-interp']), {});
  const r = await checkDiffTool(ctx, { diff });
  if (!r.ok) throw new Error(`frozen check_diff refused: ${r.message}`);
  return r.data.files.flatMap((f) => f.findings.filter((v) => v.tier === 'blocking').map((v) => ({ rule: v.ruleId, file: f.path, subject: v.subject, line: v.line, source: 'frozen' as const })));
}

/** What every session of a run shares when it is scored (built once in `main`). */
export interface SessionScoringContext {
  readonly scratch: string;
  readonly scrub: (s: string) => string;
  readonly rules: ReturnType<typeof loadRules>;
  readonly frozenEnabled: boolean;
  readonly nm: string | undefined;
  readonly env: ReturnType<typeof engineEnv>;
  readonly deps: ReturnType<typeof engineDeps> | null;
  readonly head: string | null;
  readonly onEvaluationFailure: () => void;
  /** Hexagonal study: count by `hxCounted` under this option instead of `admittedRules` (first study: undefined). */
  readonly counted?: HxOption;
  /** The task's directory, repository-relative (`--study-set`); undefined: `experiments/trap-families/<task>`. */
  readonly taskDir?: (task: string) => string;
}
export interface SessionToScore { readonly id: string; readonly sessionsDir: string; readonly task: string; readonly style: Style; readonly nSteps: number; readonly verdict: string; readonly cell: string; readonly deliveryAudit?: readonly CheckRecord[] }

/**
 * Scores the snapshots of one session (`<sessionsDir>/<id>/snap/step-00..n`): per step tests, oracle sub-goals, v1.5 and
 * frozen file-rule hits, the frozen instrument's identities; per session D_v15, Y and the frozen D. The scoring copy of
 * the session is removed by the caller (`<scratch>/<id>`).
 */
export async function scoreSessionSteps(ctx: SessionScoringContext, s: SessionToScore) {
  const { scratch, scrub, rules, frozenEnabled, nm, env, deps, head } = ctx;
  const { id, sessionsDir, nSteps } = s;
  const countedSet = (h: readonly Hit[]): Set<string> => (ctx.counted === undefined ? identitiesOf(h, admittedRules(s.style)) : identitiesBy(h, (x) => hxCounted(x, ctx.counted)));
  const agreement: Record<string, unknown>[] = [];
  const m = { task: s.task, style: s.style };
  const sess = { verdict: s.verdict, arm: s.cell };
  const taskRel = ctx.taskDir?.(m.task) ?? path.join(FAM, m.task);
  const taskDir = path.join(REPO, taskRel);
  const spec = path.join(taskDir, 'spec.yaml');
  const snaps = Array.from({ length: nSteps + 1 }, (_, k) => path.join(sessionsDir, id, 'snap', `step-0${String(k)}`)).filter((p) => fs.existsSync(p));
  const complete = sess.verdict === 'done' && snaps.length === nSteps + 1;
  const steps: Record<string, unknown>[] = [];
  const hitsPerStep: Hit[][] = [];
  const frozenIds: (IdFinding[] | null)[] = [];
  const ev = frozenEnabled ? taggedEvaluator(firewallEvaluator(path.resolve(frozenSpec(spec, path.join(scratch, `${id}.eval.yaml`))), env, deps!, (dir) => `${dir}.tsconfig.json`), 'cypher-interp') : null;
  const specView = frozenEnabled ? await loadSpecView(path.join(scratch, `${id}.eval.yaml`)) : null;
  const repo = path.join(scratch, `g-${id}`);
  const commits: string[] = [];
  fs.mkdirSync(repo, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: repo });
  const evasion = new Map<string, EvasionCandidate & { steps: string[] }>();
  for (const [k, snap] of snaps.entries()) {
    const tree = path.join(scratch, id, `s${String(k)}`);
    copyTree(snap, tree);
    const cands = k === 0 ? [] : evasionCandidates(snaps[0] as string, tree);
    neutralise(tree, snaps[0] as string, cands);
    for (const c of cands) evasion.set(c.path, { ...c, steps: [...(evasion.get(c.path)?.steps ?? []), `step-0${String(k)}`] });
    const tests = tsxJson(['experiments/puzzle-01/tools/run-tests.ts', '--puzzle', taskDir, '--tree', tree]) as TestsResult | null;
    const oracle = tsxJson([path.join(taskRel, 'oracle.ts'), tree]);
    const sg = (oracle?.subGoals as SubGoal[] | undefined) ?? null;
    const r = await scoreTreeV15(tree, rules, spec, path.join(scratch, '_s'), snaps[0] as string);
    let frozenHitsK: Hit[] = [];
    let frozenError: string | null = null;
    try { frozenHitsK = await frozenFileHits(tree, spec, scratch); } catch (e) { frozenError = scrub(String(e)).slice(0, 300); }
    const v15Hits: Hit[] = r.findings.filter((f) => f.status === 'violation').map((f) => { const shape = mirror2Shape(f.rule, f.evidence); return { rule: f.rule, file: f.file, subject: f.subject, line: f.line, source: 'v15' as const, ...(shape !== undefined ? { shape } : {}) }; });
    const hits: Hit[] = [...v15Hits, ...frozenHitsK];
    // Gate (a), findings part: the hub's checks on this exact tree (by digest) against the scorer's v15 hits.
    if (s.deliveryAudit !== undefined && k > 0) agreement.push({ step: `step-0${String(k)}`, ...findingsAgreement(s.deliveryAudit, treeDigest(snap), v15Hits, { neutralised: cands.length > 0 }) });
    hitsPerStep.push(hits);
    // The frozen v1.4 instrument (Study 2b's D input): blocking findings, check-correct `correct` only.
    if (ev !== null && specView !== null) {
      fs.symlinkSync(path.resolve(nm as string), path.join(tree, 'node_modules'));
      fs.writeFileSync(`${tree}.tsconfig.json`, `${JSON.stringify(buildHarnessTsconfig(tree), null, 2)}\n`);
      const e = await ev.evaluate(tree, `v15-study/${id}`);
      if (!e.success) { ctx.onEvaluationFailure(); frozenIds.push(null); } else {
        const reportFindings = findingsOfReport({ violations: e.data.reportViolations ?? [] }, { projectId: `${id}/${String(k)}` }, specView.style);
        const facts = new SourceFacts(tree, { tsconfig: 'adr-032' });
        const ok: IdFinding[] = [];
        for (const bf of e.data.blockingFindings) {
          const match = reportFindings.find((x) => x.violationId === bf.violationId);
          const c = match === undefined ? { verdict: 'unmatched' } : checkFinding(match, specView, facts);
          if (c.verdict === 'correct') ok.push(fromBlockingFinding(bf, e.data.reportViolations));
        }
        frozenIds.push(ok);
      }
      fs.unlinkSync(path.join(tree, 'node_modules'));
    }
    // Each scored tree is committed for the rename map (git diff -M50%, as Study 2b).
    for (const x of fs.readdirSync(repo)) if (x !== '.git') fs.rmSync(path.join(repo, x), { recursive: true, force: true });
    copyTree(tree, repo);
    execFileSync('git', ['add', '-A'], { cwd: repo });
    execFileSync('git', ['-c', 'user.name=v15-study', '-c', 'user.email=v15-study@localhost', 'commit', '-q', '--allow-empty', '-m', `step ${String(k)}`], { cwd: repo });
    commits.push(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim());
    const seedHits = hitsPerStep[0] ?? [];
    steps.push({
      step: `step-0${String(k)}`,
      tests: tests === null ? null : { passed: tests.passed, failed: tests.failed, failing: tests.cases.filter((c) => !c.ok).map((c) => c.name) },
      testsPass: testsPass(tests),
      oracle: sg === null ? null : sg.map((g) => ({ id: g.id, pass: g.pass })),
      trapFailed: trapFailed(sg),
      admittedNewVsSeed: newAgainst(countedSet(hits), countedSet(seedHits)),
      exploratoryNewVsSeed: newAgainst(identitiesOf(hits, exploratoryRules(m.style)), identitiesOf(seedHits, exploratoryRules(m.style))),
      evasionCandidates: cands.map((c) => `${c.kind} ${c.path}`),
      frozenFileRulesError: frozenError,
      // Hexagonal study (gate (b) input): the snapshot's digest and its symbolic findings new against the seed.
      ...(ctx.counted !== undefined ? { treeDigest: treeDigest(snap), symbolicNewVsSeed: newHits(hits, seedHits, (h) => hxCounted(h, ctx.counted)) } : {}),
    });
  }
  const final = steps.at(-1) as { testsPass: boolean; trapFailed: boolean | null; exploratoryNewVsSeed: string[] } | undefined;
  const y = !complete ? null : ctx.counted === undefined ? outcomeY(hitsPerStep[0] ?? [], hitsPerStep.at(-1) ?? [], m.style) : (() => { const n = newAgainst(countedSet(hitsPerStep.at(-1) ?? []), countedSet(hitsPerStep[0] ?? [])); return { Y: n.length, newIdentities: n }; })();
  const rhos = commits.map((c, k) => (k === 0 ? undefined : renameMapBetween(repo, commits[k - 1] as string, c, '.', '').rename));
  const dv = complete ? dOverSteps(hitsPerStep.map(countedSet), rhos) : { D: null, perStep: [] };
  // D of the frozen instrument: seed = step 1, the task's steps = 2…n+1 (Study 2b parameters otherwise).
  let dFrozen: Record<string, unknown> | null = null;
  if (frozenEnabled && complete && frozenIds.length === snaps.length) {
    const p: DriftParams = { ...STUDY2_S2D01, kFrom: 2, kTo: snaps.length };
    const contextId = JSON.stringify([m.task, 'cypher-interp', 'v1.3', head]);
    const si: StepInput[] = frozenIds.map((f, k) => ({ step: k + 1, final: f === null ? null : { id: commits[k] as string, contextId, ok: true, findings: f, files: [] }, ...(k > 0 ? { rename: rhos[k] } : {}) }));
    const d = driftRun(si, p, undefined, { runId: id, blockId: id, cell: sess.arm });
    dFrozen = { D: d.D, perStepNew: d.perStep.map((x) => ({ step: x.step - 1, new: x.newCount })), incomplete: d.incomplete };
  }
  return { spec, snaps, complete, steps, hitsPerStep, frozenIds, commits, rhos, evasion, final, y, dv, dFrozen, agreement };
}

/** The hits whose identity (rule | file | subject) the seed does not have, sorted, each marked counted or not (gate (b) input). */
export function newHits(hits: readonly Hit[], seedHits: readonly Hit[], isCounted: (h: Hit) => boolean): (Hit & { readonly counted: boolean })[] {
  const seed = new Set(seedHits.map(identity));
  const key = (h: Hit): string => `${h.rule}|${h.file}|${String(h.line ?? '')}|${h.subject}|${h.source}`;
  return hits.filter((h) => !seed.has(identity(h))).sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
    .map((h) => ({ rule: h.rule, file: h.file, subject: h.subject, line: h.line, source: h.source, ...(h.shape !== undefined ? { shape: h.shape } : {}), counted: isCounted(h) }));
}

interface MapEntry { readonly task: string; readonly style: Style; readonly confirmatory: boolean }

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const results = arg('results');
  const inputFile = arg('input');
  if (results === undefined || inputFile === undefined) {
    process.stderr.write('usage: score-study.ts --results <outRoot> --input <input.json> [--node-modules <dir>] [--hub <dir>] [--out <dir>]\n');
    return 2;
  }
  const input = JSON.parse(fs.readFileSync(inputFile, 'utf8')) as { vault: string; tasks: { id: string; steps: string[] }[]; studySet?: string };
  const map = JSON.parse(fs.readFileSync(path.join(input.vault, 'private-id-map.json'), 'utf8')) as Record<string, MapEntry>;
  // Confirmatory status is read from study-set.json at scoring time too (it must agree with the input's map).
  // `--study-set` (or the input's `studySet`): the manifest, and each task's directory from it.
  const setArg = arg('study-set');
  if (setArg !== undefined && input.studySet !== undefined && path.posix.normalize(setArg) !== input.studySet) { process.stderr.write(`--study-set ${setArg} differs from the input's studySet ${input.studySet}\n`); return 2; }
  const manifest = setArg ?? input.studySet;
  const studySet = loadStudySet(REPO, manifest ?? DEFAULT_STUDY_SET);
  const confirmatorySet = new Set([...studySet.confirmatory.ddd, ...studySet.confirmatory.hexagonal]);
  const hubDir = path.resolve(arg('hub') ?? path.join(results, 'hub'));
  const outDir = path.resolve(arg('out') ?? path.join(results, 'scores'));
  const nm = arg('node-modules');
  // Hexagonal study: `--counted hx-i|hx-ii` (D by `hxCounted`) and `--require-delivery-audit` (a combined session
  // without a delivery audit is flagged). Both off: the first study's scoring, unchanged.
  const countedArg = arg('counted');
  if (countedArg !== undefined && countedArg !== 'hx-i' && countedArg !== 'hx-ii') { process.stderr.write('--counted must be hx-i or hx-ii\n'); return 2; }
  const counted: HxOption | undefined = countedArg === undefined ? undefined : countedArg === 'hx-i' ? 'i' : 'ii';
  const requireAudit = argv.includes('--require-delivery-audit');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-study-score-'));
  const scrub = (s: string): string => s.split(scratch).join('<scratch>').split(path.resolve(results)).join('<results>').split(REPO).join('.').split(os.tmpdir()).join('<tmp>');
  const rules = loadRules();
  const state = fs.existsSync(path.join(results, 'state.json')) ? (JSON.parse(fs.readFileSync(path.join(results, 'state.json'), 'utf8')) as { done: Record<string, string> }) : null;
  const countedIds = state === null ? null : new Set(Object.values(state.done));
  const sessionsDir = path.join(results, 'sessions');
  const ids = fs.existsSync(sessionsDir) ? fs.readdirSync(sessionsDir).filter((d) => fs.existsSync(path.join(sessionsDir, d, 'session.json'))).sort() : [];
  const schedule = fs.existsSync(path.join(results, 'schedule.json')) ? new Set((JSON.parse(fs.readFileSync(path.join(results, 'schedule.json'), 'utf8')) as { schedule: { id: string }[] }).schedule.map((s) => s.id)) : null;
  const redrawn = new Set(readLines<{ as: string }>(path.join(results, 'redraws.jsonl')).map((r) => r.as));
  const frozenEnabled = nm !== undefined;
  const env = engineEnv(process.env, 'cypher-interp');
  const deps = frozenEnabled ? engineDeps(buildContext({}, env).evaluateDeps, 'cypher-interp') : null;
  const head = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(); } catch { return null; } })();
  const runs: Record<string, unknown>[] = [];
  let evaluationFailures = 0;
  const sctx: SessionScoringContext = { scratch, scrub, rules, frozenEnabled, nm, env, deps, head, onEvaluationFailure: () => { evaluationFailures++; }, ...(counted !== undefined ? { counted } : {}), ...(manifest !== undefined ? { taskDir: studySet.dirOf } : {}) };
  try {
    for (const id of ids) {
      if (schedule !== null && !schedule.has(id) && !redrawn.has(id)) continue;
      const sess = JSON.parse(fs.readFileSync(path.join(sessionsDir, id, 'session.json'), 'utf8')) as { taskId: string; arm: string; rep: number; planId: string; redrawOf: string | null; verdict: string; steps: unknown[]; integrity: unknown; deliveryAudit?: CheckRecord[] };
      const m = map[sess.taskId];
      if (m === undefined) throw new Error(`no private map entry for ${sess.taskId}`);
      const sc = await scoreSessionSteps(sctx, { id, sessionsDir, task: m.task, style: m.style, nSteps: input.tasks.find((t) => t.id === sess.taskId)?.steps.length ?? 0, verdict: sess.verdict, cell: sess.arm, ...(sess.deliveryAudit !== undefined ? { deliveryAudit: sess.deliveryAudit } : {}) });
      const { spec, snaps, complete, steps, evasion, final, y, dv, dFrozen, agreement } = sc;
      // Delivered = scored (DEV-3 lesson): every hub check's rule list against the scored lists; a difference flags the block.
      const delivery: AuditVerdict | null = sess.arm === 'combined' ? auditVerdict(sess.deliveryAudit, m.style, counted !== undefined ? hxCountedRuleIds() : admittedRules(m.style), { require: requireAudit }) : null;
      // Arm combined: the hub's ledger and the attribution table.
      let attribution: Record<string, unknown> | null = null;
      if (sess.arm === 'combined') {
        const ledgerFile = path.join(hubDir, `${id}.ledger.json`);
        const ledger = fs.existsSync(ledgerFile) ? (JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) as { rows: LedgerRow[]; hookEvents: number; failOpen: number }) : null;
        const push = readLines<PushLogLine>(path.join(hubDir, `${id}.push.jsonl`));
        const calls = readLines<{ tool: string }>(path.join(hubDir, `${id}.calls.jsonl`));
        const finalKeys = new Set<string>();
        if (snaps.length > 1) {
          const last = snaps.at(-1) as string;
          // The keys the hub gives on the final tree: the style's delivered set (the one rule list), both rule kinds.
          const cc = await checkConsistency({ root: path.resolve(last), spec, scratch: path.join(scratch, '_cc'), rules: cypherRules(m.style), baseline: path.resolve(snaps[0] as string), ...(scorerJudgeFromEnv() !== null ? { mirrorJudge: scorerJudgeFromEnv()! } : {}) }).catch(() => null);
          for (const f of cc?.findings ?? []) finalKeys.add(keyOf(f, cc!.aggregateRoots).key);
          const changed = (() => { const a = new Set<string>(); const walk = (d: string, rel: string): void => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel === '' ? e.name : `${rel}/${e.name}`; if (e.isDirectory()) walk(path.join(d, e.name), r); else a.add(r); } }; walk(last, ''); return [...a]; })();
          const lay = await checkLayers({ root: path.resolve(last), spec, seedDir: path.resolve(snaps[0] as string), changed, rules: frozenRules(m.style) }).catch(() => null);
          for (const f of lay?.findings ?? []) finalKeys.add(f.key);
        }
        const table = attributionTable(ledger?.rows ?? [], finalKeys);
        attribution = { ledgerFound: ledger !== null, findings: table.rows.length, counts: table.counts, rows: table.rows, doubleReports: doubleReports(push, ledger?.rows ?? []), pushEvents: push.length, pullCalls: calls.length, pullByTool: Object.fromEntries([...new Set(calls.map((c) => c.tool))].map((t) => [t, calls.filter((c) => c.tool === t).length])) };
      }
      runs.push({
        session: id, planId: sess.planId, task: sess.taskId, style: m.style, confirmatory: confirmatorySet.has(m.task), arm: sess.arm, rep: sess.rep, redrawOf: sess.redrawOf, verdict: sess.verdict,
        counted: complete && (countedIds === null || countedIds.has(id)),
        D: dv.D, DperStep: dv.perStep,
        flagged: (sess.integrity as { flagged?: boolean } | null)?.flagged === true || delivery?.flagged === true,
        delivery: delivery === null ? null : { ...delivery, findingsAgreement: agreement },
        evasion: { count: evasion.size, candidates: [...evasion.values()].map((c) => ({ path: c.path, kind: c.kind, steps: c.steps })) },
        Y: y?.Y ?? null, newAdmittedIdentities: y?.newIdentities ?? null,
        trapFailed: complete ? (final?.trapFailed ?? null) : null,
        functional: complete ? (final?.testsPass ?? null) : null,
        exploratoryNew: complete ? (final?.exploratoryNewVsSeed ?? null) : null,
        D_frozen: dFrozen,
        integrity: sess.integrity ?? null,
        attribution,
        steps,
      });
      fs.rmSync(path.join(scratch, id), { recursive: true, force: true });
      process.stdout.write(`${id} ${sess.taskId} ${sess.arm}: D ${String(dv.D)} Y ${String(y?.Y ?? null)} evasion ${String(evasion.size)} trapFailed ${String(final?.trapFailed ?? null)} functional ${String(final?.testsPass ?? null)} D_frozen ${String((dFrozen as { D?: unknown } | null)?.D ?? null)}\n`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  // Per-turn wall time per arm (cost, secondary 6), from the driver's turns.jsonl, counted sessions only.
  const countedSessions = new Set((runs as { session: string; counted: boolean }[]).filter((r) => r.counted).map((r) => r.session));
  const turnLines = readLines<{ session: string; arm: string; wallMs: number | null; status: string }>(path.join(results, 'turns.jsonl')).filter((t) => countedSessions.has(t.session));
  const wallOf = (arm: string): Record<string, number | null> => {
    const xs = turnLines.filter((t) => t.arm === arm && typeof t.wallMs === 'number').map((t) => t.wallMs as number).sort((x, y) => x - y);
    const med = xs.length === 0 ? null : xs.length % 2 === 1 ? (xs[(xs.length - 1) / 2] as number) : ((xs[xs.length / 2 - 1] as number) + (xs[xs.length / 2] as number)) / 2;
    return { turns: xs.length, medianMs: med, meanMs: xs.length === 0 ? null : Math.round(xs.reduce((x, y) => x + y, 0) / xs.length), maxMs: xs.length === 0 ? null : (xs.at(-1) as number) };
  };
  const byArm = (arm: string): Record<string, unknown> => {
    const rs = runs.filter((r) => r.arm === arm && r.counted === true) as { Y: number | null; trapFailed: boolean | null; functional: boolean | null }[];
    const ys = rs.map((r) => r.Y).filter((x): x is number => x !== null);
    return { turnWallTime: wallOf(arm), runs: rs.length, meanY: ys.length === 0 ? null : +(ys.reduce((a, b) => a + b, 0) / ys.length).toFixed(3), runsWithY0: ys.filter((y) => y === 0).length, trapFailed: rs.filter((r) => r.trapFailed === true).length, functional: rs.filter((r) => r.functional === true).length };
  };
  const out = {
    schema: 'v15-study-scores/v1', modelCalls: 0, instrumentCommit: head, instrumentId: INSTRUMENT_ID, instrumentRuleHash: instrumentRuleHash().hash,
    params: {
      admitted: { ddd: { rows: ADMITTED_DDD_ROWS, rules: admittedRules('ddd') }, hexagonal: { rows: ADMITTED_HEX_ROWS, rules: admittedRules('hexagonal') }, overrides: ROW_OVERRIDES },
      exploratory: { ddd: exploratoryRules('ddd'), hexagonal: exploratoryRules('hexagonal') },
      counted: counted === undefined ? 'admitted rows (first study)' : { mode: `hx-${counted}`, rules: HX_COUNTED_RULES, mirror2Shapes: HX_MIRROR2_SHAPES[counted] }, requireDeliveryAudit: requireAudit,
      identity: 'rule|file|subject', D: 'admitted identities new against the seed and every earlier step, summed over the steps (renames carried)', Y: 'admitted identities on the final step not on the seed (step-00)',
      evasionPatterns: EVASION_PATTERNS.map(String),
      frozenD: frozenEnabled ? { ...STUDY2_S2D01, kFrom: 2, kTo: 'steps + 1', seedAsStep: 1 } : 'skipped (no --node-modules)',
    },
    evaluationFailures,
    summary: { none: byArm('none'), combined: byArm('combined') },
    runs,
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'scores.json'), `${scrub(JSON.stringify(out, null, 1))}\n`);
  // The analysis input: one cell per counted session (ITT: every scored session that is the plan's accepted run).
  const cells: AnalysisCell[] = (runs as unknown as { counted: boolean; task: string; style: Style; rep: number; arm: 'none' | 'combined'; D: number | null; trapFailed: boolean | null; functional: boolean | null; flagged: boolean; D_frozen: { D: number | null } | null }[])
    .filter((r) => r.counted)
    .map((r) => ({ task: r.task, style: r.style, rep: r.rep, arm: r.arm, D: r.D, trapFailed: r.trapFailed, accepted: r.functional, flagged: r.flagged, D_frozen: r.D_frozen?.D ?? null }));
  fs.writeFileSync(path.join(outDir, 'cells.json'), `${JSON.stringify({ schema: 'v15-study-cells/v1', cells }, null, 1)}\n`);
  return evaluationFailures > 0 ? 1 : 0;
}

if (process.argv[1]?.endsWith('score-study.ts') === true) {
  main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exitCode = 2; });
}
