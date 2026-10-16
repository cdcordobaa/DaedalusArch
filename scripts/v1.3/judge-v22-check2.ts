/**
 * Judge v2.2 evaluation on CHECK-2: fresh bases, seeds and paired twins that no judge has seen. DEVELOPMENT SET.
 *
 * CHECK-2 replaces the spent CHECK split of `judge-v2-split.ts` (`Docs/DiagnosticRuns/v1.3-judge-v2-2026-10-16.md`
 * §6, §8). Plan, composition and the decision rule fixed in advance: `Docs/v1.3/judge-v22-plan.md`.
 *
 * Bases (`tests/fixtures/v1.3-check2/<baseId>/`): ten small projects written for CHECK-2 (six layered, one each of
 * clean-architecture, nestjs, hexagonal and ddd). Each holds `project/` and `spec.yaml` (the evaluation spec: the style
 * preset verbatim; for ddd the preset plus its `architecture.ddd` block and FF-N01/FF-N02). The layered bases also hold
 * `seed-spec.yaml`, used ONLY to find operator sites (the business layer split into a domain-kind model and an
 * application-kind service layer, because the operators look for service classes in application-kind layers).
 *
 * Families (one positive site and its paired twin per base and family; existing operators, unchanged):
 *   FRAMEWORK-LEAK       AP-FRAMEWORK-LEAK / AP-FRAMEWORK-LEAKn          FF-N02
 *   PERSIST-IN-DOMAIN    AP-PERSIST-IN-DOMAIN / AP-PERSIST-IN-DOMAINn    FF-N02
 *   REPO-BYPASS          AP-REPO-BYPASS / AP-REPO-BYPASSn                FF-N01   (layered, nestjs)
 *                        MO-DF01 / MO-DF01n (domain class holds a repository implementation)   FF-N02
 *                        where AP-REPO-BYPASS has no site by construction (clean, hexagonal, ddd: an application
 *                        service with an ORM-injected field would itself be a violation there)
 *   LOGIC-IN-CONTROLLER  AP-FAT-CONTROLLER / AP-FAT-CONTROLLERn          FF-N02
 * Site choice: the eligible sites (`eligibleSites`: `findSites` plus the precondition pass), narrowed to the preferred
 * ones (below) when any is preferred, one drawn with mulberry32(uint32(sha256(`${CHECK2_SALT}|${baseId}|${family}`))).
 * Preferred: a holder class whose name does not end in Error/Exception; for MO-DF01 a target named `*Repository*`, in
 * the holder's own bounded context on ddd. The twin is the twin operator's eligible site closest to the positive: same
 * file and detail, else same file and class/method/handler, else same file, else (MO-DF01n) the mirror (holder = the
 * positive's target class), else its first site.
 *
 * Phases (repository root):
 *   seed --out <work> [--check]   bases → <work>/bases, copies → <work>/copies, manifest → <work>/seed-manifest.json;
 *                                 without --check also results/v1.3-judge-v22/check2-seed-manifest.json; with --check
 *                                 the fresh manifest must equal the committed one byte for byte. No Neo4j, no model.
 *   plan <work>                   mock evaluate (Neo4j, no model) of every base and copy, target units, crafted baseline
 *                                 reports, and the CHECK-2 item list → results/v1.3-judge-v22/check2-split.json
 *                                 (`--check`: must equal the committed split).
 *   harvest <work> --judge-version v1|v2.2
 *                                 mock evaluate per target with its crafted baseline: the product path builds each
 *                                 prompt; → results/v1.3-judge-v22/prompts/check2-<version>.json (`--check`: compare).
 *   budget [--runs 3]             projected calls of the record phases (distinct prompt × run not yet in the cassettes,
 *                                 plus one init probe per phase). No call.
 *   record --judge-version v1|v2.2 [--runs 3] [--budget <n>]
 *                                 the ONLY phase that calls the judge: committed prompts through one isolated Claude
 *                                 CLI provider per phase, in the cassette decorator (record mode). Resumable.
 *   score                         metrics and the pre-registered decision rule → results/v1.3-judge-v22/check2-scores.md
 * The local one-command runner is `scripts/v1.3/judge-v22-check2-local.sh`.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AP_FAT_CONTROLLER, AP_FAT_CONTROLLERN } from '../lib/mutation/antipatterns/ap-fat-controller.js';
import { AP_FRAMEWORK_LEAK, AP_FRAMEWORK_LEAKN } from '../lib/mutation/antipatterns/ap-framework-leak.js';
import { AP_PERSIST_IN_DOMAIN, AP_PERSIST_IN_DOMAINN } from '../lib/mutation/antipatterns/ap-persist-in-domain.js';
import { AP_REPO_BYPASS, AP_REPO_BYPASSN } from '../lib/mutation/antipatterns/ap-repo-bypass.js';
import { CATALOGUE_OPERATORS } from '../lib/mutation/operators/index.js';
import { mulberry32 } from '../lib/mutation/rng.js';
import { detailJson } from '../lib/mutation/sites.js';
import type { MutationOperator, MutationSite } from '../lib/mutation/types.js';
import { parseLLMOptions } from '../../src/cli/llm-options.js';
import { createJudgeProvider } from '../../src/llm-critic/provider-factory.js';
import { disposeJudgeProvider } from '../../src/llm-critic/judge-stage.js';
import { JUDGE_V22_PERSONA, JUDGE_V22_REVISION, computeJudgeV22Sha256 } from '../../src/llm-critic/judge-v22.js';
import { FROZEN_SHA256 } from '../../src/llm-critic/frozen.js';
import { injectedFields, thisAccesses } from '../lib/mutation/antipatterns/common.js';
import { openImportGraphProject } from '../lib/mutation/import-graph.js';
import { applyOne, copyDir, eligibleSites, typecheck } from './judge-catch-seed.js';
import type { SeedBase } from './judge-catch-seed.js';
import { unitsHolding } from './judge-catch-run.js';
import { fmt, metricsOf } from './judge-v2-score.js';
import type { Metrics } from './judge-v2-score.js';
import type { ItemVerdict } from './judge-v2-run.js';
import type { SplitItem } from './judge-v2-split.js';

const REPO = process.cwd();
export const CHECK2_ROOT = 'tests/fixtures/v1.3-check2';
export const RESULTS22 = 'results/v1.3-judge-v22';
export const CASSETTES22 = 'tests/fixtures/judge-cassettes-v13/judge-v22';
export const CHECK2_SALT = 'daedalus-v1.3-judge-v22-check2-20261016';
export const CHECK2_RUNS = 3;
export const CHECK2_VERSIONS = ['v1', 'v2.2'] as const;
export type Check2Version = (typeof CHECK2_VERSIONS)[number];

export interface Check2Base {
  readonly baseId: string;
  readonly style: string;
  /** Fixture root holding the base; the set's root when absent. */
  readonly root?: string;
}

export const CHECK2_BASES: readonly Check2Base[] = [
  { baseId: 'layered-library', style: 'layered' },
  { baseId: 'layered-clinic', style: 'layered' },
  { baseId: 'layered-fleet', style: 'layered' },
  { baseId: 'layered-ticketing', style: 'layered' },
  { baseId: 'layered-payroll', style: 'layered' },
  { baseId: 'layered-warehouse', style: 'layered' },
  { baseId: 'clean-subscriptions', style: 'clean-architecture' },
  { baseId: 'nestjs-courses', style: 'nestjs' },
  { baseId: 'hexagonal-parking', style: 'hexagonal' },
  { baseId: 'ddd-insurance', style: 'ddd' },
];

/**
 * CHECK-3 (`Docs/v1.3/judge-check3-plan.md`): CHECK-2 with the six layered bases rebuilt so that the clean base and
 * the twin carry no repository bypass. In CHECK-2 every layered base had one business service holding the
 * persistence layer's `PrismaService` (the only shape on which AP-REPO-BYPASS places a site), so every clean FF-N01
 * business unit already bypassed the gateways (`Docs/DiagnosticRuns/v1.3-judge-v22-check2-2026-10-16.md` §0). In
 * CHECK-3 that service goes through a new persistence gateway; the CHECK-2 version of the service (and of `main.ts`,
 * which wires it) is kept in `<base>/seed-overlay/` and is laid over the base ONLY to build the AP-REPO-BYPASS seed.
 * The AP-REPO-BYPASSn twin is applied to the clean base, on the same class and method, to the gateway field. The four
 * other bases are CHECK-2's own files (same root), and the salt is CHECK-2's, so every draw whose eligible sites did
 * not move is the CHECK-2 site.
 */
export const CHECK3_ROOT = 'tests/fixtures/v1.3-check3';
export const RESULTS_CHECK3 = 'results/v1.3-judge-check3';
export const CHECK3_BASES: readonly Check2Base[] = CHECK2_BASES.map((b) => ({ ...b, root: b.style === 'layered' ? CHECK3_ROOT : CHECK2_ROOT }));
export const SEED_OVERLAY = 'seed-overlay';

export interface CheckSet {
  readonly set: 'CHECK-2' | 'CHECK-3';
  /** Prefix of item ids, file names and cassette labels. */
  readonly key: 'check2' | 'check3';
  readonly root: string;
  readonly results: string;
  readonly salt: string;
  readonly planDoc: string;
  readonly bases: readonly Check2Base[];
}

export const CHECK_SETS: Readonly<Record<'check2' | 'check3', CheckSet>> = {
  check2: { set: 'CHECK-2', key: 'check2', root: CHECK2_ROOT, results: RESULTS22, salt: CHECK2_SALT, planDoc: 'Docs/v1.3/judge-v22-plan.md §5', bases: CHECK2_BASES },
  check3: { set: 'CHECK-3', key: 'check3', root: CHECK3_ROOT, results: RESULTS_CHECK3, salt: CHECK2_SALT, planDoc: 'Docs/v1.3/judge-check3-plan.md §4', bases: CHECK3_BASES },
};

/** The set every phase works on (`--set check2|check3`, default check2). */
let active: CheckSet = CHECK_SETS.check2;

const MO_DF01 = CATALOGUE_OPERATORS.find((o) => o.id === 'MO-DF01');
const MO_DF01N = CATALOGUE_OPERATORS.find((o) => o.id === 'MO-DF01n');
if (MO_DF01 === undefined || MO_DF01N === undefined) throw new Error('MO-DF01 is not in the frozen catalogue');

export interface Family {
  readonly family: string;
  /** Pairs in order of preference: the first pair whose positive has an eligible site is used. */
  readonly pairs: readonly { readonly positive: MutationOperator; readonly twin: MutationOperator; readonly fn: 'FF-N01' | 'FF-N02' }[];
}

export const FAMILIES: readonly Family[] = [
  { family: 'FRAMEWORK-LEAK', pairs: [{ positive: AP_FRAMEWORK_LEAK, twin: AP_FRAMEWORK_LEAKN, fn: 'FF-N02' }] },
  { family: 'PERSIST-IN-DOMAIN', pairs: [{ positive: AP_PERSIST_IN_DOMAIN, twin: AP_PERSIST_IN_DOMAINN, fn: 'FF-N02' }] },
  {
    family: 'REPO-BYPASS',
    pairs: [{ positive: AP_REPO_BYPASS, twin: AP_REPO_BYPASSN, fn: 'FF-N01' }, { positive: MO_DF01, twin: MO_DF01N, fn: 'FF-N02' }],
  },
  { family: 'LOGIC-IN-CONTROLLER', pairs: [{ positive: AP_FAT_CONTROLLER, twin: AP_FAT_CONTROLLERN, fn: 'FF-N02' }] },
];

export interface Check2Row {
  readonly rowId: string;
  readonly family: string;
  readonly operatorId: string;
  readonly role: 'seed' | 'twin';
  readonly probedFunction: 'FF-N01' | 'FF-N02';
  readonly baseId: string;
  readonly style: string;
  readonly specPath: string;
  readonly seedSpecPath: string;
  readonly site: MutationSite;
  readonly selection: { readonly eligible: number; readonly preferred: number; readonly index: number } | { readonly twinOf: string; readonly twinMatch: string };
  readonly status: 'ok' | 'apply-error' | 'typecheck' | 'comment-added';
  readonly editedFiles: readonly string[];
  readonly createdFiles: readonly string[];
  readonly typecheckErrors: readonly string[];
  readonly addedComments: readonly string[];
  /** Touched files whose added lines were put into the file's own indentation and quote style (`normaliseAdded`). */
  readonly styleNormalised: readonly string[];
  /** CHECK-3 AP-REPO-BYPASS seeds only: the `seed-overlay` files laid over the base before the operator ran. */
  readonly overlayFiles?: readonly string[];
  readonly editSha256: string;
  readonly copyDir: string;
}

// ── helpers ──

function arg(argv: readonly string[], name: string, dflt: string): string {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : dflt;
}

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export const sha256 = (text: string | Buffer): string => createHash('sha256').update(text).digest('hex');
const safe = (id: string): string => id.replace(/[/:]/g, '__');

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk(dir);
  return out;
}

/** sha256 over the sorted relative paths and bytes of a directory tree. */
export function treeSha256(dir: string): string {
  const h = createHash('sha256');
  for (const f of filesUnder(dir)) {
    h.update(path.relative(dir, f).split(path.sep).join('/'));
    h.update('\u0000');
    h.update(fs.readFileSync(f));
    h.update('\u0000');
  }
  return h.digest('hex');
}

export function seedOf(key: string): number {
  return createHash('sha256').update(key).digest().readUInt32BE(0);
}

const baseDir = (b: Check2Base): string => path.join(b.root ?? active.root, b.baseId);
const evalSpecOf = (b: Check2Base): string => path.join(baseDir(b), 'spec.yaml');
const seedSpecOf = (b: Check2Base): string => {
  const own = path.join(baseDir(b), 'seed-spec.yaml');
  return fs.existsSync(path.resolve(REPO, own)) ? own : evalSpecOf(b);
};

function seedBase(b: Check2Base): SeedBase {
  return { baseId: b.baseId, kind: 'fixture', style: b.style, dir: path.resolve(REPO, baseDir(b), 'project'), specPath: path.resolve(REPO, seedSpecOf(b)) };
}

/** Project-relative files of a base's seeding-only overlay (CHECK-3 layered bases), or none. */
export function overlayFilesOf(b: Check2Base): string[] {
  const dir = path.resolve(REPO, baseDir(b), SEED_OVERLAY);
  return fs.existsSync(dir) ? filesUnder(dir).map((f) => path.relative(dir, f).split(path.sep).join('/')) : [];
}

/** The base with its overlay laid over it, materialised under `<work>/overlay/<baseId>` (AP-REPO-BYPASS seeds only). */
function overlayBase(b: Check2Base, sb: SeedBase, work: string): SeedBase {
  const dir = path.join(work, 'overlay', b.baseId);
  copyDir(sb.dir, dir);
  for (const f of overlayFilesOf(b)) fs.copyFileSync(path.resolve(REPO, baseDir(b), SEED_OVERLAY, f), path.join(dir, f));
  return { ...sb, dir };
}

/**
 * The AP-REPO-BYPASSn site on the clean base for an AP-REPO-BYPASS seed drawn on the overlay: same file, class and
 * method, on the one constructor-injected field of the clean class that the method reads (the persistence gateway).
 */
export function cleanTwinSite(dir: string, seedSite: MutationSite): MutationSite | undefined {
  const handle = openImportGraphProject(dir, 'tsconfig.json');
  const cls = handle.project.getSourceFile(path.join(dir, seedSite.filePath))?.getClass(seedSite.detail.class ?? '');
  const m = cls?.getMethod(seedSite.detail.method ?? '');
  if (cls === undefined || m === undefined) return undefined;
  const fields = injectedFields(cls).filter((f) => thisAccesses(m, f.getName()).length > 0);
  const [only] = fields;
  if (only === undefined || fields.length !== 1) return undefined;
  const field = only.getName();
  return { filePath: seedSite.filePath, line: m.getStartLineNumber(), kind: 'repo-bypass', detail: { class: seedSite.detail.class ?? '', method: m.getName(), field } };
}

/** Holder class of a site (the class the edit lands in). */
function holderOf(site: MutationSite): string {
  return site.detail.class ?? site.detail.serviceClass ?? site.detail.controller ?? '';
}

/** The preferred sites of a family on a base (see the header); all sites when none is preferred. */
export function preferred(sites: readonly MutationSite[], op: MutationOperator, style: string): MutationSite[] {
  const ok = sites.filter((s) => {
    if (/(?:Error|Exception)$/.test(holderOf(s))) return false;
    if (op.id === 'MO-DF01') {
      if (!/Repository/.test(s.detail.targetName ?? '')) return false;
      if (style === 'ddd' && s.filePath.split('/')[1] !== (s.detail.targetFile ?? '').split('/')[1]) return false;
    }
    return true;
  });
  return ok.length > 0 ? ok : [...sites];
}

/** The twin site closest to the positive, with how it was matched. */
export function pairTwin(positive: MutationSite, twins: readonly MutationSite[]): { site: MutationSite; match: string } | undefined {
  const score = (t: MutationSite): [number, string] => {
    if (t.filePath === positive.filePath && detailJson(t.detail) === detailJson(positive.detail)) return [5, 'same-site'];
    const shared = ['class', 'method', 'handler', 'controller'].filter((k) => (t.detail[k] ?? '') !== '' && (positive.detail[k] ?? '') !== '');
    const sameMember = shared.length > 0 && shared.every((k) => t.detail[k] === positive.detail[k]);
    if (t.filePath === positive.filePath && sameMember) return [4, 'same-member'];
    if (t.filePath === positive.filePath) return [3, 'same-file'];
    if ((t.detail.class ?? '') !== '' && t.detail.class === positive.detail.targetName) return [2, 'mirror'];
    return [1, 'same-base'];
  };
  let best: { site: MutationSite; match: string; s: number } | undefined;
  for (const t of twins) {
    const [s, match] = score(t);
    if (best === undefined || s > best.s) best = { site: t, match, s };
  }
  return best === undefined ? undefined : { site: best.site, match: best.match };
}

/** Line-level LCS: for each line of `after`, whether it is added (not matched to a line of `before`). */
export function addedLineMask(before: readonly string[], after: readonly string[]): boolean[] {
  const n = before.length;
  const m = after.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = before[i] === after[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const added = new Array<boolean>(m).fill(true);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      added[j] = false;
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else j++;
  }
  return added;
}

const indentOf = (line: string): number => /^ */.exec(line)?.[0].length ?? 0;

/** Bracket balance of a line, ignoring string and template-literal contents. */
function balance(line: string): { opens: number; closes: number } {
  let opens = 0;
  let closes = 0;
  let quote: string | undefined;
  for (let i = 0; i < line.length; i++) {
    const c = line[i] as string;
    if (quote !== undefined) {
      if (c === '\\') i++;
      else if (c === quote) quote = undefined;
      continue;
    }
    if (c === '/' && line[i + 1] === '/') break;
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '{' || c === '(' || c === '[') opens++;
    else if (c === '}' || c === ')' || c === ']') closes++;
  }
  return { opens, closes };
}

/**
 * Expected indentation of every line under a bracket-depth model: a line sits at its level times the file's unit,
 * one level less when it starts with a closing bracket, one more when it starts with `.` (a chained call).
 */
export function expectedIndents(lines: readonly string[], unit: number): number[] {
  // One indentation level per line that leaves brackets open, however many it opens (`.catch((e) => {`).
  const levels: number[] = [];
  return lines.map((line) => {
    const t = line.trim();
    const closesFirst = /^[})\]]/.test(t);
    const at = Math.max(0, levels.length - (closesFirst ? 1 : 0)) + (t.startsWith('.') ? 1 : 0);
    const b = balance(t);
    let net = b.opens - b.closes;
    while (net < 0 && levels.length > 0) {
      const top = levels.pop() as number;
      if (top + net > 0) {
        levels.push(top + net);
        net = 0;
      } else net += top;
    }
    if (net > 0) levels.push(net);
    return at * unit;
  });
}

/**
 * Puts the lines an operator added or changed into the file's own style, so formatting is no cue: an added line whose
 * indentation differs from the bracket-depth model (`expectedIndents`, with the file's indentation unit) is re-indented,
 * and a double-quoted import specifier becomes single-quoted when the file's other imports use single quotes.
 * Unchanged lines are never touched. Returns the text and whether it changed.
 */
export function normaliseAdded(before: string, after: string): { text: string; changed: boolean } {
  const old = before.split('\n');
  const lines = after.split('\n');
  const added = addedLineMask(old, lines);
  const widths = old.map(indentOf).filter((w) => w > 0);
  const unit = widths.length === 0 ? 2 : Math.min(...widths);
  const single = old.some((l) => /^import .* from '/.test(l)) && !old.some((l) => /^import .* from "/.test(l));
  const expected = expectedIndents(lines, unit);
  const out = lines.map((line, j) => {
    if (!added[j] || line.trim() === '') return added[j] ? '' : line;
    let text = `${' '.repeat(expected[j] ?? 0)}${line.trim()}`;
    if (single && /^import .* from "[^"']*";?$/.test(text)) text = text.replace(/from "([^"']*)"/, "from '$1'");
    return text;
  });
  const text = out.join('\n');
  return { text, changed: text !== after };
}

/** Lines a copy adds to a file that hold a comment (`//`, `/*`), against the base. */
export function addedCommentLines(before: string | undefined, after: string): string[] {
  const old = new Set((before ?? '').split('\n'));
  return after.split('\n').filter((l) => !old.has(l) && /(^|\s)(\/\/|\/\*)/.test(l));
}

// ── seed ──

async function seed(argv: readonly string[]): Promise<number> {
  const out = path.resolve(arg(argv, '--out', ''));
  if (arg(argv, '--out', '') === '') {
    process.stderr.write('seed needs --out <work>\n');
    return 2;
  }
  const check = argv.includes('--check');
  fs.mkdirSync(out, { recursive: true });
  const rows: Check2Row[] = [];
  const table: { baseId: string; family: string; operatorId: string; eligible: number; candidates: number; rejected: Record<string, number> }[] = [];
  const bases: { baseId: string; style: string; specPath: string; seedSpecPath: string; treeSha256: string; specSha256: string }[] = [];
  for (const b of active.bases) {
    const sb = seedBase(b);
    const overlay = overlayFilesOf(b);
    const ob = overlay.length > 0 ? overlayBase(b, sb, out) : undefined;
    bases.push({
      baseId: b.baseId, style: b.style, specPath: evalSpecOf(b), seedSpecPath: seedSpecOf(b), treeSha256: treeSha256(sb.dir),
      specSha256: sha256(fs.readFileSync(path.resolve(REPO, evalSpecOf(b)))),
      ...(ob === undefined ? {} : { overlayFiles: overlay, overlayTreeSha256: treeSha256(path.resolve(REPO, baseDir(b), SEED_OVERLAY)) }),
    });
    copyDir(sb.dir, path.join(out, 'bases', b.baseId));
    for (const fam of FAMILIES) {
      let chosen: { pair: Family['pairs'][number]; sites: MutationSite[] } | undefined;
      for (const pair of fam.pairs) {
        // CHECK-3: the bypass seed is drawn on the overlay; the clean base has no injected ORM field in its business layer.
        const r = await eligibleSites(REPO, ob !== undefined && pair.positive === AP_REPO_BYPASS ? ob : sb, pair.positive);
        table.push({ baseId: b.baseId, family: fam.family, operatorId: pair.positive.id, eligible: r.eligible.length, candidates: r.candidates, rejected: r.rejected });
        if (chosen === undefined && r.eligible.length > 0) chosen = { pair, sites: r.eligible };
      }
      if (chosen === undefined) {
        process.stderr.write(`${b.baseId}: no ${fam.family} site\n`);
        continue;
      }
      const { pair } = chosen;
      const viaOverlay = ob !== undefined && pair.positive === AP_REPO_BYPASS;
      const pref = preferred(chosen.sites, pair.positive, b.style);
      const rng = mulberry32(seedOf(`${active.salt}|${b.baseId}|${fam.family}`));
      const index = Math.floor(rng.next() * pref.length);
      const site = pref[index] as MutationSite;
      let twin: { site: MutationSite; match: string } | undefined;
      if (viaOverlay) {
        const t = cleanTwinSite(sb.dir, site);
        twin = t === undefined ? undefined : { site: t, match: 'same-member-clean-base' };
        table.push({ baseId: b.baseId, family: fam.family, operatorId: pair.twin.id, eligible: t === undefined ? 0 : 1, candidates: t === undefined ? 0 : 1, rejected: {} });
      } else {
        const tw = await eligibleSites(REPO, sb, pair.twin);
        table.push({ baseId: b.baseId, family: fam.family, operatorId: pair.twin.id, eligible: tw.eligible.length, candidates: tw.candidates, rejected: tw.rejected });
        twin = pairTwin(site, tw.eligible);
      }
      const seedId = `${b.baseId}__${pair.positive.id}`;
      const jobs: { op: MutationOperator; site: MutationSite; role: 'seed' | 'twin'; selection: Check2Row['selection'] }[] = [
        { op: pair.positive, site, role: 'seed', selection: { eligible: chosen.sites.length, preferred: pref.length, index } },
        ...(twin === undefined ? [] : [{ op: pair.twin, site: twin.site, role: 'twin' as const, selection: { twinOf: seedId, twinMatch: twin.match } }]),
      ];
      for (const job of jobs) {
        const rowId = `${b.baseId}__${job.op.id}`;
        const dest = path.join(out, 'copies', rowId);
        // Only the CHECK-3 bypass seed starts from the overlay; its twin and every other row start from the clean base.
        const from: SeedBase = (viaOverlay && job.role === 'seed' ? ob : undefined) ?? sb;
        const overlayFiles = from === sb ? [] : overlay;
        const res0 = await applyOne(REPO, from, job.op, job.site, dest);
        const touched = [...new Set([...res0.editedFiles, ...res0.createdFiles])].sort();
        const normalised = res0.status !== 'ok' ? [] : touched.filter((f) => {
          const before = path.join(from.dir, f);
          const file = path.join(dest, f);
          const r = normaliseAdded(fs.existsSync(before) ? fs.readFileSync(before, 'utf8') : '', fs.readFileSync(file, 'utf8'));
          if (r.changed) fs.writeFileSync(file, r.text);
          return r.changed;
        });
        const recheck = normalised.length > 0 ? typecheck(REPO, dest) : [];
        const res = recheck.length === 0 ? res0 : { ...res0, status: 'typecheck' as const, typecheckErrors: recheck };
        const added = [...new Set([...touched, ...overlayFiles])].sort().flatMap((f) => {
          const before = path.join(sb.dir, f);
          return addedCommentLines(fs.existsSync(before) ? fs.readFileSync(before, 'utf8') : undefined, fs.readFileSync(path.join(dest, f), 'utf8')).map((l) => `${f}: ${l.trim()}`);
        });
        const status: Check2Row['status'] = res.status === 'ok' && added.length > 0 ? 'comment-added' : res.status === 'ok' ? 'ok' : res.status === 'typecheck' ? 'typecheck' : 'apply-error';
        rows.push({
          rowId, family: fam.family, operatorId: job.op.id, role: job.role, probedFunction: pair.fn, baseId: b.baseId, style: b.style,
          specPath: evalSpecOf(b), seedSpecPath: seedSpecOf(b), site: job.site, selection: job.selection, status,
          editedFiles: res.editedFiles, createdFiles: res.createdFiles, typecheckErrors: res.typecheckErrors, addedComments: added, styleNormalised: normalised,
          ...(overlayFiles.length === 0 ? {} : { overlayFiles }),
          editSha256: sha256([...new Set([...touched, ...overlayFiles])].sort().map((f) => `${f}\u0000${fs.readFileSync(path.join(dest, f), 'utf8')}`).join('\u0000')),
          copyDir: path.join('copies', rowId),
        });
        process.stderr.write(`${rowId}: ${status}${res.typecheckErrors[0] !== undefined ? ` (${res.typecheckErrors[0]})` : ''}\n`);
      }
    }
  }
  const manifest = {
    schema: 1, set: active.set, salt: active.salt, applySeed: 20261015,
    families: FAMILIES.map((f) => ({ family: f.family, pairs: f.pairs.map((p) => ({ positive: p.positive.id, twin: p.twin.id, fn: p.fn })) })),
    bases, table, rows,
  };
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(path.join(out, 'seed-manifest.json'), text);
  const committed = path.resolve(REPO, active.results, `${active.key}-seed-manifest.json`);
  const bad = rows.filter((r) => r.status !== 'ok');
  process.stdout.write(`${String(rows.length)} rows (${String(rows.filter((r) => r.role === 'seed').length)} seeds), ${String(bad.length)} not ok; manifest sha256 ${sha256(text)}\n`);
  if (check) {
    const same = fs.existsSync(committed) && fs.readFileSync(committed, 'utf8') === text;
    process.stdout.write(same ? 'seed manifest matches the committed one\n' : 'SEED MANIFEST DIFFERS from the committed one\n');
    return same && bad.length === 0 ? 0 : 1;
  }
  fs.mkdirSync(path.dirname(committed), { recursive: true });
  fs.writeFileSync(committed, text);
  return bad.length === 0 ? 0 : 1;
}

// ── plan and split (mock evaluate; Neo4j, no model) ──

interface ReportLike {
  readonly neuralResults?: readonly {
    functionId: string;
    selection: { candidateUnitIds: string[]; selectedUnitIds: string[]; source: string };
    unitResults: { unitId: string; filePaths?: string[]; verdict: string }[];
  }[];
}

interface Target {
  readonly id: string;
  readonly kind: 'seed' | 'twin' | 'clean';
  readonly baseId: string;
  readonly family: string;
  readonly operatorId: string;
  readonly projectDir: string; // relative to the work dir
  readonly specPath: string;
  readonly units: Readonly<Record<string, readonly string[]>>;
}

function evaluate(projectDir: string, spec: string, extra: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const tsx = path.resolve(REPO, 'node_modules/.bin/tsx');
  const args = ['bin/firewall.ts', 'evaluate', '--project', projectDir, '--spec', path.resolve(REPO, spec), '--format', 'json', '--neo4j-uri', process.env['NEO4J_URI'] ?? '', ...extra];
  const r = spawnSync(tsx, args, { cwd: REPO, env: process.env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 3_600_000 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function parseReport(stdout: string): ReportLike | null {
  const i = stdout.indexOf('{');
  if (i < 0) return null;
  try {
    return JSON.parse(stdout.slice(i)) as ReportLike;
  } catch {
    return null;
  }
}

export interface Check2Item extends SplitItem {
  readonly family: string;
  readonly style: string;
  /** For a layered clean or twin unit: the unit lies in the business layer (the §8 construct). */
  readonly layeredBusiness: boolean;
}

export interface Check2Split {
  readonly set: CheckSet['set'];
  readonly salt: string;
  readonly seedManifestSha256: string;
  readonly itemsSha256: string;
  readonly counts: Record<string, number>;
  readonly targets: readonly Omit<Target, 'projectDir'>[];
  readonly items: readonly Check2Item[];
}

function plan(work: string, check: boolean): number {
  const manifestText = fs.readFileSync(path.join(work, 'seed-manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestText) as { rows: Check2Row[] };
  const rows = manifest.rows.filter((r) => r.status === 'ok');
  const projects = [
    ...active.bases.map((b) => ({ id: `base:${b.baseId}`, dir: path.join(work, 'bases', b.baseId), spec: evalSpecOf(b) })),
    ...rows.map((r) => ({ id: r.rowId, dir: path.join(work, r.copyDir), spec: r.specPath })),
  ];
  const reports = new Map<string, ReportLike>();
  for (const p of projects) {
    const file = path.join(work, 'mock-full', `${safe(p.id)}.json`);
    if (!fs.existsSync(file)) {
      const r = evaluate(p.dir, p.spec, ['--llm-provider', 'mock', '--cassette-dir', path.join(work, 'mock-full-cassettes')]);
      const rep = parseReport(r.stdout);
      if (rep === null) {
        process.stderr.write(`${p.id}: no report (exit ${String(r.status)}): ${r.stderr.slice(-800)}\n`);
        return 1;
      }
      writeJson(file, rep);
      process.stderr.write(`${p.id}: mock evaluate exit ${String(r.status)}\n`);
    }
    reports.set(p.id, readJson<ReportLike>(file));
  }
  const rowOf = (id: string, fn: string): { cands: string[]; filesOf: Map<string, string[]> } => {
    const row = reports.get(id)?.neuralResults?.find((n) => n.functionId === fn);
    if (row === undefined) throw new Error(`${id}: no neural row for ${fn}`);
    return { cands: row.selection.candidateUnitIds, filesOf: new Map(row.unitResults.filter((u) => u.filePaths !== undefined).map((u) => [u.unitId, u.filePaths ?? []])) };
  };
  const targets: Target[] = [];
  const baseUnits = new Map<string, Map<string, Set<string>>>();
  for (const r of rows) {
    const files = [...new Set([...r.editedFiles, ...r.createdFiles])];
    const own = rowOf(r.rowId, r.probedFunction);
    const units = [...new Set(files.flatMap((f) => unitsHolding(own.cands, own.filesOf, f)))].sort();
    if (units.length === 0) throw new Error(`${r.rowId}: no candidate unit holds ${files.join(', ')}`);
    targets.push({ id: r.rowId, kind: r.role, baseId: r.baseId, family: r.family, operatorId: r.operatorId, projectDir: r.copyDir, specPath: r.specPath, units: { [r.probedFunction]: units } });
    const baseCands = rowOf(`base:${r.baseId}`, r.probedFunction).cands;
    const m = baseUnits.get(r.baseId) ?? new Map<string, Set<string>>();
    const s = m.get(r.probedFunction) ?? new Set<string>();
    for (const u of units.filter((x) => baseCands.includes(x))) s.add(u);
    m.set(r.probedFunction, s);
    baseUnits.set(r.baseId, m);
  }
  for (const b of [...active.bases].reverse()) {
    const m = baseUnits.get(b.baseId);
    if (m === undefined) continue;
    targets.unshift({
      id: `base:${b.baseId}`, kind: 'clean', baseId: b.baseId, family: '', operatorId: '', projectDir: path.join('bases', b.baseId), specPath: evalSpecOf(b),
      units: Object.fromEntries([...m].map(([fn, s]) => [fn, [...s].sort()])),
    });
  }
  for (const t of targets) {
    const rep = reports.get(t.id) ?? {};
    const neuralResults = (rep.neuralResults ?? []).map((n) => ({ ...n, selection: { ...n.selection, source: 'own', selectedUnitIds: [...(t.units[n.functionId] ?? [])] } }));
    writeJson(path.join(work, 'baseline', `${safe(t.id)}.json`), { neuralResults });
  }
  writeJson(path.join(work, 'plan.json'), { targets });
  const styleOf = new Map(active.bases.map((b) => [b.baseId, b.style]));
  const items: Check2Item[] = targets.flatMap((t) => Object.entries(t.units).flatMap(([fn, us]) => us.map((u) => ({
    itemId: `${active.key}|${t.id}|${fn}|${u}`, round: active.key, targetId: t.id, kind: t.kind, functionId: fn, unitId: u, baseId: t.baseId,
    operatorId: t.operatorId, cluster: t.baseId, split: 'CHECK' as const, family: t.family, style: styleOf.get(t.baseId) ?? '',
    layeredBusiness: styleOf.get(t.baseId) === 'layered' && u.startsWith('src/business'),
  }))));
  const itemsText = JSON.stringify(items);
  const counts: Record<string, number> = { items: items.length, targets: targets.length };
  for (const k of ['seed', 'twin', 'clean']) counts[k] = items.filter((i) => i.kind === k).length;
  counts['layeredBusinessClean'] = items.filter((i) => i.kind === 'clean' && i.layeredBusiness).length;
  const split: Check2Split = {
    set: active.set, salt: active.salt, seedManifestSha256: sha256(manifestText), itemsSha256: sha256(itemsText), counts,
    targets: targets.map(({ projectDir: _p, ...rest }) => rest), items,
  };
  const text = `${JSON.stringify(split, null, 2)}\n`;
  const committed = path.resolve(REPO, active.results, `${active.key}-split.json`);
  process.stdout.write(`${String(targets.length)} targets, ${String(items.length)} items (${JSON.stringify(counts)}); items sha256 ${split.itemsSha256}\n`);
  if (check) {
    const same = fs.existsSync(committed) && fs.readFileSync(committed, 'utf8') === text;
    process.stdout.write(same ? 'split matches the committed one\n' : 'SPLIT DIFFERS from the committed one\n');
    return same ? 0 : 1;
  }
  fs.writeFileSync(committed, text);
  return 0;
}

export function readCheck2Split(): Check2Split {
  return readJson<Check2Split>(path.resolve(REPO, active.results, `${active.key}-split.json`));
}

// ── harvest (mock evaluate per target; Neo4j, no model) ──

export interface Check2Prompts {
  readonly judgeVersion: Check2Version;
  readonly revision: string;
  readonly textSha256: string;
  readonly itemsSha256: string;
  readonly records: readonly { readonly itemId: string; readonly functionId: string; readonly unitId: string; readonly prompt: string; readonly promptSha256: string }[];
}

const promptsFile = (v: Check2Version): string => path.resolve(REPO, active.results, 'prompts', `${active.key}-${v}.json`);

function entriesIn(dir: string): { functionId: string; unitId?: string; prompt?: string; runIndex: number }[] {
  const out: { functionId: string; unitId?: string; prompt?: string; runIndex: number }[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const sub of fs.readdirSync(dir)) {
    const p = path.join(dir, sub);
    if (sub === '_incomplete' || !fs.statSync(p).isDirectory()) continue;
    for (const f of fs.readdirSync(p).filter((x) => x.endsWith('.json'))) out.push(readJson(path.join(p, f)));
  }
  return out;
}

function harvest(work: string, version: Check2Version, check: boolean): number {
  const split = readCheck2Split();
  const { targets } = readJson<{ targets: Target[] }>(path.join(work, 'plan.json'));
  const records: Check2Prompts['records'][number][] = [];
  for (const t of targets) {
    const cas = path.join(work, `harvest-${version}`, safe(t.id));
    fs.rmSync(cas, { recursive: true, force: true });
    const r = evaluate(path.join(work, t.projectDir), t.specPath, [
      '--llm-provider', 'mock', ...(version === 'v1' ? [] : ['--judge-version', version]),
      '--cassette-dir', cas, '--judge-baseline-report', path.join(work, 'baseline', `${safe(t.id)}.json`)]);
    const got = entriesIn(cas).filter((e) => e.runIndex === 0 && e.prompt !== undefined);
    for (const [fn, us] of Object.entries(t.units)) {
      for (const u of us) {
        const e = got.find((x) => x.functionId === fn && (x.unitId ?? '') === u);
        if (e === undefined) {
          process.stderr.write(`${t.id}: exit ${String(r.status)}; no ${version} prompt for ${fn} ${u}: ${r.stderr.slice(-600)}\n`);
          return 1;
        }
        const prompt = e.prompt ?? '';
        if (prompt.includes('[REDACTED]') || e.functionId !== fn) {
          process.stderr.write(`${t.id}: the cassette scrubbed part of the ${fn} ${u} prompt (an environment variable named like a secret has a value found in it); harvest under a minimal environment (env -i)\n`);
          return 1;
        }
        records.push({ itemId: `${active.key}|${t.id}|${fn}|${u}`, functionId: fn, unitId: u, prompt, promptSha256: sha256(prompt) });
      }
    }
    if (/JUDGE_V2_FLAGS_UNAVAILABLE/.test(r.stdout + r.stderr)) process.stderr.write(`${t.id}: cheap flags unavailable\n`);
  }
  records.sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0));
  const missing = split.items.filter((i) => !records.some((r) => r.itemId === i.itemId));
  if (missing.length > 0) {
    process.stderr.write(`${String(missing.length)} split item(s) without a prompt, e.g. ${missing[0]?.itemId ?? ''}\n`);
    return 1;
  }
  const file: Check2Prompts = {
    judgeVersion: version, revision: version === 'v1' ? 'v1-frozen' : JUDGE_V22_REVISION,
    textSha256: version === 'v1' ? FROZEN_SHA256 : computeJudgeV22Sha256(), itemsSha256: split.itemsSha256, records,
  };
  const text = `${JSON.stringify(file, null, 2)}\n`;
  process.stdout.write(`${version}: ${String(records.length)} prompts, ${String(new Set(records.map((r) => r.prompt)).size)} distinct\n`);
  if (check) {
    const committed = readJson<Check2Prompts>(promptsFile(version));
    const differ = records.filter((r) => committed.records.find((c) => c.itemId === r.itemId)?.promptSha256 !== r.promptSha256);
    process.stdout.write(differ.length === 0 ? `${version}: harvested prompts match the committed ones\n` : `${version}: ${String(differ.length)} PROMPT(S) DIFFER, e.g. ${differ[0]?.itemId ?? ''}\n`);
    return differ.length === 0 ? 0 : 1;
  }
  fs.mkdirSync(path.dirname(promptsFile(version)), { recursive: true });
  fs.writeFileSync(promptsFile(version), text);
  return 0;
}

// ── budget and record (the record phase is the only one that calls the judge) ──

interface Ledger { calls: number; phases: { label: string; at: string; judgeAttempts: number; initProbes: number; hits: number; stop?: string }[] }
const ledgerFile = (): string => path.resolve(REPO, active.results, 'call-ledger.json');
const labelOf = (v: Check2Version): string => `${active.key}-${v}`;

function loadPrompts(version: Check2Version): Check2Prompts {
  const file = readJson<Check2Prompts>(promptsFile(version));
  const split = readCheck2Split();
  if (file.itemsSha256 !== split.itemsSha256) throw new Error(`prompts ${version}: harvested for another item list`);
  if (version === 'v2.2' && file.textSha256 !== computeJudgeV22Sha256()) throw new Error(`prompts v2.2: harvested with other v2.2 texts (${file.textSha256}); re-harvest`);
  if (version === 'v1' && file.textSha256 !== FROZEN_SHA256) throw new Error('prompts v1: the frozen judge moved');
  for (const r of file.records) {
    if (sha256(r.prompt) !== r.promptSha256) throw new Error(`prompts ${version}: ${r.itemId} was edited`);
    if (r.prompt.includes('[REDACTED]')) throw new Error(`prompts ${version}: ${r.itemId} holds a scrubbed value; re-harvest under env -i`);
  }
  return file;
}

/** Cassette entries already stored for (prompt, run) of a version, by filename stem; used to project the calls. */
function storedEntries(version: Check2Version): Set<string> {
  const dir = path.resolve(REPO, CASSETTES22, labelOf(version));
  const out = new Set<string>();
  for (const e of entriesIn(dir)) if (e.prompt !== undefined) out.add(`${sha256(e.prompt)}|${String(e.runIndex)}`);
  return out;
}

export function projectedCalls(version: Check2Version, runs: number): { items: number; distinctPrompts: number; stored: number; calls: number } {
  const file = loadPrompts(version);
  const distinct = [...new Set(file.records.map((r) => r.promptSha256))];
  const stored = storedEntries(version);
  let missing = 0;
  for (const p of distinct) for (let k = 0; k < runs; k++) if (!stored.has(`${p}|${String(k)}`)) missing++;
  return { items: file.records.length, distinctPrompts: distinct.length, stored: distinct.length * runs - missing, calls: missing === 0 ? 0 : missing + 1 };
}

function budget(argv: readonly string[]): number {
  const runs = Number(arg(argv, '--runs', String(CHECK2_RUNS)));
  const ledger: Ledger = fs.existsSync(ledgerFile()) ? readJson<Ledger>(ledgerFile()) : { calls: 0, phases: [] };
  let total = 0;
  process.stdout.write(`${active.set} call budget (runs per unit ${String(runs)}; each record phase adds 1 init probe when it calls):\n`);
  for (const v of CHECK2_VERSIONS) {
    const p = projectedCalls(v, runs);
    total += p.calls;
    process.stdout.write(`  ${v}: ${String(p.items)} items, ${String(p.distinctPrompts)} distinct prompts, ${String(p.stored)} (prompt, run) entries already in the cassettes -> ${String(p.calls)} call(s)\n`);
  }
  process.stdout.write(`  total: ${String(total)} call(s); ledger so far ${String(ledger.calls)}\n`);
  return 0;
}

function majority(runs: ItemVerdict['runs']): ItemVerdict['verdict'] {
  const valid = runs.filter((r) => r.valid);
  if (valid.length === 0) return 'invalid';
  const fails = valid.filter((r) => r.pass === false).length;
  if (fails * 2 > valid.length) return 'fail';
  if ((valid.length - fails) * 2 > valid.length) return 'pass';
  return 'warning';
}

async function record(argv: readonly string[]): Promise<number> {
  const version = arg(argv, '--judge-version', '') as Check2Version;
  if (!CHECK2_VERSIONS.includes(version)) {
    process.stderr.write('record needs --judge-version v1|v2.2\n');
    return 2;
  }
  const runs = Number(arg(argv, '--runs', String(CHECK2_RUNS)));
  const cap = Number(arg(argv, '--budget', '1000'));
  const file = loadPrompts(version);
  const ledger: Ledger = fs.existsSync(ledgerFile()) ? readJson<Ledger>(ledgerFile()) : { calls: 0, phases: [] };
  const projected = projectedCalls(version, runs);
  process.stdout.write(`${labelOf(version)}: ${String(projected.items)} items, ${String(projected.distinctPrompts)} distinct prompts x ${String(runs)} runs; projected ${String(projected.calls)} call(s); ledger ${String(ledger.calls)} of ${String(cap)}\n`);
  if (ledger.calls + projected.calls > cap) {
    process.stdout.write(`budget: refusing (${String(ledger.calls)} + ${String(projected.calls)} > ${String(cap)})\n`);
    return 4;
  }
  const label = labelOf(version);
  const cassetteDir = path.resolve(REPO, CASSETTES22, label);
  // Everything already stored: replay (no pre-flight call); otherwise record (one init probe, then the misses).
  const mode = projected.calls === 0 ? 'replay' : 'record';
  const parsed = parseLLMOptions(['--llm-provider=claude-cli', `--cassette-mode=${mode}`, `--cassette-dir=${cassetteDir}`], process.env, { projectRoot: path.resolve(REPO, active.results) });
  if (!parsed.success) {
    process.stderr.write(`${parsed.errors[0]?.message ?? 'bad options'}\n`);
    return 2;
  }
  const config = parsed.data;
  const phase: Ledger['phases'][number] = { label, at: new Date().toISOString(), judgeAttempts: 0, initProbes: 0, hits: 0 };
  const out = new Map<string, ItemVerdict['runs'][number][]>();
  const jobs: { rec: Check2Prompts['records'][number]; runIndex: number }[] = [];
  for (const rec of file.records) for (let runIndex = 0; runIndex < runs; runIndex++) jobs.push({ rec, runIndex });
  let stopped: string | undefined;
  {
    const wrapped = await createJudgeProvider(config, { judgeConfigDir: config.judgeConfigDir }, {});
    if (!wrapped.success) {
      const e = wrapped.errors[0];
      phase.stop = `${e?.code ?? ''}: ${e?.message ?? ''}`.replace(/\/(Users|Volumes|private|home)\/[^\s'"]*/g, '<path>');
      phase.initProbes = mode === 'record' && /LLM_USAGE_LIMIT|LLM_AUTH|Init probe/.test(phase.stop) ? 1 : 0;
      ledger.calls += phase.initProbes;
      ledger.phases.push(phase);
      writeJson(ledgerFile(), ledger);
      process.stdout.write(`pre-flight failed: ${phase.stop}\n`);
      return 3;
    }
    const cassette = wrapped.data;
    phase.initProbes = mode === 'record' ? 1 : 0;
    ledger.calls += phase.initProbes;
    const llm = config.run.llm;
    let next = 0;
    const worker = async (): Promise<void> => {
      while (stopped === undefined && next < jobs.length) {
        const job = jobs[next++];
        if (job === undefined) break;
        const res = await cassette.judge(job.rec.prompt, llm, {
          runIndex: job.runIndex, repetition: 0, functionId: job.rec.functionId, unitId: job.rec.unitId,
          ...(version === 'v2.2' ? { systemPrompt: JUDGE_V22_PERSONA } : {}),
        });
        if (res.kind === 'stop') {
          stopped = `${res.stop}: ${res.message}`;
          break;
        }
        if (res.hit) phase.hits++;
        else phase.judgeAttempts += res.entry.attempts;
        const v = res.verdict;
        const run = res.outcome.kind === 'valid' && v !== null
          ? { runIndex: job.runIndex, valid: true, pass: v.pass, confidence: v.confidence, violations: v.violations, reasoning: v.reasoning }
          : { runIndex: job.runIndex, valid: false };
        out.set(job.rec.itemId, [...(out.get(job.rec.itemId) ?? []), run]);
        if ((phase.judgeAttempts + phase.hits) % 20 === 0) process.stderr.write(`${label}: ${String(phase.judgeAttempts)} calls, ${String(phase.hits)} hits\n`);
      }
    };
    // Concurrency only (default 3, the judge's MAX_CONCURRENCY); results and cassette keys do not depend on it.
    const workers = Math.max(1, Number(arg(argv, '--workers', '3')));
    await Promise.all(Array.from({ length: workers }, () => worker()));
    disposeJudgeProvider(cassette.innerProvider);
  }
  ledger.calls += phase.judgeAttempts;
  if (stopped !== undefined) phase.stop = stopped.replace(/\/(Users|Volumes|private|home)\/[^\s'"]*/g, '<path>');
  ledger.phases.push(phase);
  writeJson(ledgerFile(), ledger);
  const verdicts: ItemVerdict[] = file.records.map((r) => {
    const rs = [...(out.get(r.itemId) ?? [])].sort((a, b) => a.runIndex - b.runIndex);
    return { itemId: r.itemId, runs: rs, verdict: majority(rs) };
  });
  writeJson(path.resolve(REPO, active.results, label, 'verdicts.json'), {
    set: active.set, runs, judgeVersion: version, revision: file.revision, textSha256: file.textSha256, complete: stopped === undefined, verdicts,
  });
  process.stdout.write(`${label}: ${String(phase.judgeAttempts)} calls + ${String(phase.initProbes)} init probe, ${String(phase.hits)} hits; ledger ${String(ledger.calls)}${stopped !== undefined ? `; STOPPED ${phase.stop ?? ''} (rerun to resume)` : ''}\n`);
  return stopped === undefined ? 0 : 3;
}

// ── score and the decision rule (fixed in Docs/v1.3/judge-v22-plan.md §5 before any call) ──

type V = 'pass' | 'fail' | 'warning' | 'invalid' | 'missing';

export interface Decision {
  readonly outcome: 'CANDIDATE' | 'NOT CANDIDATE' | 'INCONCLUSIVE';
  readonly checks: readonly { readonly id: string; readonly rule: string; readonly v1: string; readonly v22: string; readonly holds: boolean }[];
}

const count = (items: readonly Check2Item[], verdict: (i: SplitItem) => V, pred: (i: Check2Item) => boolean): number => items.filter((i) => pred(i) && verdict(i) === 'fail').length;

/** The decision rule of the plan (§5), applied to the two judges' unit verdicts. Pure, so a test pins it. */
export function decide(items: readonly Check2Item[], v1: (i: SplitItem) => V, v22: (i: SplitItem) => V): Decision {
  const m1 = metricsOf(items, v1);
  const m2 = metricsOf(items, v22);
  const layeredClean = (i: Check2Item): boolean => i.kind === 'clean' && i.layeredBusiness;
  const lc1 = count(items, v1, layeredClean);
  const lc2 = count(items, v22, layeredClean);
  const lcN = items.filter(layeredClean).length;
  const realConstruct = (i: Check2Item): boolean => i.kind === 'clean' || ((i.family === 'REPO-BYPASS' || i.family === 'PERSIST-IN-DOMAIN') && i.style !== 'layered');
  const rc1 = metricsOf(items.filter(realConstruct), v1);
  const rc2 = metricsOf(items.filter(realConstruct), v22);
  const invalid = (verdict: (i: SplitItem) => V): number => items.filter((i) => ['invalid', 'missing', 'warning'].includes(verdict(i))).length;
  const checks = [
    { id: 'D1', rule: 'layered business clean units: v2.2 false fails <= 1 and <= v1\'s', v1: `${String(lc1)}/${String(lcN)}`, v22: `${String(lc2)}/${String(lcN)}`, holds: lc2 <= 1 && lc2 <= lc1 },
    { id: 'D2', rule: 'catch: v2.2 >= v1 - 1', v1: `${String(m1.caught)}/${String(m1.seeds)}`, v22: `${String(m2.caught)}/${String(m2.seeds)}`, holds: m2.caught >= m1.caught - 1 },
    { id: 'D3', rule: 'paired catch: v2.2 >= v1 - 1', v1: `${String(m1.pairedCaught)}/${String(m1.seeds)}`, v22: `${String(m2.pairedCaught)}/${String(m2.seeds)}`, holds: m2.pairedCaught >= m1.pairedCaught - 1 },
    { id: 'D4', rule: 'twin false fail: v2.2 <= v1 + 1', v1: `${String(m1.twinFail)}/${String(m1.twins)}`, v22: `${String(m2.twinFail)}/${String(m2.twins)}`, holds: m2.twinFail <= m1.twinFail + 1 },
    { id: 'D5', rule: 'clean false fail (all units): v2.2 <= v1', v1: `${String(m1.cleanFail)}/${String(m1.cleanUnits)}`, v22: `${String(m2.cleanFail)}/${String(m2.cleanUnits)}`, holds: m2.cleanFail <= m1.cleanFail },
    { id: 'D6', rule: 'real construct (non-layered REPO-BYPASS and PERSIST-IN-DOMAIN seeds): v2.2 catch >= v1 catch', v1: `${String(rc1.caught)}/${String(rc1.seeds)}`, v22: `${String(rc2.caught)}/${String(rc2.seeds)}`, holds: rc2.caught >= rc1.caught },
  ];
  const i1 = invalid(v1);
  const i2 = invalid(v22);
  const validity = { id: 'D0', rule: 'at most 2 units without a majority verdict (invalid, tied or missing) per judge', v1: String(i1), v22: String(i2), holds: i1 <= 2 && i2 <= 2 };
  const outcome = !validity.holds ? 'INCONCLUSIVE' : checks.every((c) => c.holds) ? 'CANDIDATE' : 'NOT CANDIDATE';
  return { outcome, checks: [validity, ...checks] };
}

function row(name: string, m: Metrics): string {
  return `| ${name} | ${fmt(m.caught, m.seeds)} | ${fmt(m.pairedCaught, m.seeds)} | ${fmt(m.twinFail, m.twins)} | ${fmt(m.twinPairedFail, m.twins)} | ${fmt(m.cleanFail, m.cleanUnits)} | ${String(m.invalidUnits)} |`;
}

function score(): number {
  const split = readCheck2Split();
  const verdictsOf = (v: Check2Version): Map<string, ItemVerdict> => {
    const f = path.resolve(REPO, active.results, labelOf(v), 'verdicts.json');
    if (!fs.existsSync(f)) throw new Error(`no verdicts for ${v}: run record --judge-version ${v}`);
    const file = readJson<{ complete: boolean; verdicts: ItemVerdict[] }>(f);
    if (!file.complete) process.stdout.write(`WARNING: ${v} verdicts are incomplete\n`);
    return new Map(file.verdicts.map((x) => [x.itemId, x]));
  };
  const a = verdictsOf('v1');
  const b = verdictsOf('v2.2');
  const v1 = (i: SplitItem): V => a.get(i.itemId)?.verdict ?? 'missing';
  const v22 = (i: SplitItem): V => b.get(i.itemId)?.verdict ?? 'missing';
  const items = split.items;
  const lines: string[] = [];
  lines.push(`${active.set}: ${String(items.length)} items (${JSON.stringify(split.counts)}); unit verdict = majority of ${String(CHECK2_RUNS)} runs for both judges; items sha256 ${split.itemsSha256}.`, '');
  lines.push('| Judge | Catch | Paired catch | Twin false fail | Paired twin false fail | Clean false fail (units) | Invalid units |', '|---|---|---|---|---|---|---|');
  lines.push(row('v1', metricsOf(items, v1)), row('v2.2', metricsOf(items, v22)));
  for (const [name, pred] of [
    ['layered bases', (i: Check2Item): boolean => i.style === 'layered'],
    ['other styles', (i: Check2Item): boolean => i.style !== 'layered'],
  ] as const) {
    const its = items.filter(pred);
    lines.push(row(`v1, ${name}`, metricsOf(its, v1)), row(`v2.2, ${name}`, metricsOf(its, v22)));
  }
  lines.push('', '| Family | Judge | Catch | Paired catch | Twin false fail |', '|---|---|---|---|---|');
  for (const f of FAMILIES.map((x) => x.family)) {
    const its = items.filter((i) => i.kind === 'clean' || i.family === f);
    for (const [name, vf] of [['v1', v1], ['v2.2', v22]] as const) {
      const m = metricsOf(its, vf);
      lines.push(`| ${f} | ${name} | ${fmt(m.caught, m.seeds)} | ${fmt(m.pairedCaught, m.seeds)} | ${fmt(m.twinFail, m.twins)} |`);
    }
  }
  const d = decide(items, v1, v22);
  lines.push('', `**Decision (rule fixed in ${active.planDoc}): ${d.outcome}**`, '', '| Check | Rule | v1 | v2.2 | Holds |', '|---|---|---|---|---|');
  for (const c of d.checks) lines.push(`| ${c.id} | ${c.rule} | ${c.v1} | ${c.v22} | ${c.holds ? 'yes' : 'NO'} |`);
  lines.push('', 'Items whose verdict differs (v1 → v2.2):');
  for (const i of items) if (v1(i) !== v22(i)) lines.push(`- ${i.kind} ${i.family || 'clean'} ${i.targetId} ${i.functionId} ${i.unitId}: ${v1(i)} → ${v22(i)}`);
  const md = `${lines.join('\n')}\n`;
  fs.writeFileSync(path.resolve(REPO, active.results, `${active.key}-scores.md`), md);
  writeJson(path.resolve(REPO, active.results, `${active.key}-decision.json`), d);
  process.stdout.write(md);
  return 0;
}

export async function main(argv: readonly string[]): Promise<number> {
  const setKey = arg(argv, '--set', 'check2');
  if (setKey !== 'check2' && setKey !== 'check3') {
    process.stderr.write('--set must be check2 or check3\n');
    return 2;
  }
  active = CHECK_SETS[setKey];
  const [phase, work] = argv;
  const check = argv.includes('--check');
  switch (phase) {
    case 'seed': return seed(argv);
    case 'plan': return work === undefined ? 2 : plan(path.resolve(work), check);
    case 'harvest': return work === undefined ? 2 : harvest(path.resolve(work), arg(argv, '--judge-version', '') as Check2Version, check);
    case 'budget': return budget(argv);
    case 'record': return record(argv);
    case 'score': return score();
    default:
      process.stderr.write('usage (each phase takes [--set check2|check3], default check2): judge-v22-check2.ts seed --out <work> [--check] | plan <work> [--check] | harvest <work> --judge-version v1|v2.2 [--check] | budget | record --judge-version v1|v2.2 [--runs 3] [--budget n] | score\n');
      return 2;
  }
}

if (process.argv[1]?.endsWith('judge-v22-check2.ts') === true) void main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
