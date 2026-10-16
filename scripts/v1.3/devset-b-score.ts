/**
 * devset-b scoring (offline). Entry file: no exports. Reads the saved live outputs of a devset-b run
 * (`ue-baseline-live.ts --set devset-b`), the author-manifests and each style's `devset-b.json` (variant roles), and
 * writes per-style and per-rule figures with Wilson 95% intervals. Nothing is tuned: matching is the runner's
 * (`compare.ts`, cycle findings keyed on their file set).
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/devset-b-score.ts --base results/v1.3-devset-b
 * Reads <base>/raw/<style>/<variant>.json and <base>/evidence/<style>/<variant>.json.
 * Writes <base>/scores.json and <base>/scores.md.
 *
 * Definitions (blocking rules = the v1.3 tier `blocking` under the style):
 *   found x/n          expected findings of the rule on violation variants that a tool row matched / all of them
 *   reports right x/n  tool rows of the rule that match an expected finding / all tool rows of the rule, over every
 *                      devset-b variant (violations, look-alikes, clean); the `baseline` variant (the reference
 *                      set's clean project, in-sample) is excluded from every count
 *   false alarm        a tool row of a blocking rule on a look-alike or clean variant (whose manifests expect nothing)
 * FF-P06 rows from the field half (relType FLOWS_TO, the tier's N/A part) are counted like any row and flagged.
 *
 * Two views. `literal`: the runner's matching unchanged; an FF-S02 row matches only a manifest cycle with the same
 * file set. `cycle-containment` (declared normalisation): the manifests name a cycle by its smallest file and the next
 * one (the reference convention, written for 2-file cycles), while the tool's row carries the whole cycle path; a
 * cycle row whose files include both files of an unmatched expected FF-S02 finding of the same variant is keyed to
 * that finding. Nothing else differs between the views.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compareVariant, cycleFileSet } from './lib/compare.js';
import type { ActualFinding, Mismatch, VariantComparison } from './lib/compare.js';
import { DEVSET_B_ROOT, loadAllReferences } from './lib/reference-model.js';
import type { ExpectedFinding, LoadedReference } from './lib/reference-model.js';

type View = 'literal' | 'cycle-containment';
const VIEWS: readonly View[] = ['literal', 'cycle-containment'];

/** cycle-containment: re-keys an FF-S02 row to the expected cycle finding whose two files it contains. */
function containCycles(expected: readonly ExpectedFinding[], actual: readonly ActualFinding[]): ActualFinding[] {
  const open = expected.filter((e) => e.ruleId === 'FF-S02');
  const exact = new Set(actual.filter((a) => a.ruleId === 'FF-S02').map((a) => cycleFileSet(a)));
  const claimed = new Set<number>();
  return actual.map((a) => {
    if (a.ruleId !== 'FF-S02') return a;
    const files = new Set(cycleFileSet(a).split(','));
    const i = open.findIndex((e, j) => !claimed.has(j) && !exact.has(cycleFileSet(e)) && files.has(e.file) && e.target !== undefined && files.has(e.target));
    if (i < 0) return a;
    claimed.add(i);
    const e = open[i] as ExpectedFinding;
    return { ruleId: a.ruleId, file: e.file, ...(e.target !== undefined ? { target: e.target } : {}) };
  });
}

type Role = 'baseline' | 'violation' | 'look-alike' | 'clean';
interface RoleFile {
  readonly style: string;
  readonly variants: Readonly<Record<string, { readonly role: Role; readonly rule?: string }>>;
  readonly notPlanted?: readonly { readonly ruleId: string; readonly reason: string }[];
}

const argv = process.argv.slice(2);
const baseIdx = argv.indexOf('--base');
const BASE = path.resolve(baseIdx >= 0 ? argv[baseIdx + 1] ?? '' : 'results/v1.3-devset-b');
const ROOT = process.cwd();

function wilson(k: number, n: number): [number, number] | null {
  if (n === 0) return null;
  const z = 1.959964;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}

interface Ratio { readonly x: number; readonly n: number; readonly ci: [number, number] | null }
const ratio = (x: number, n: number): Ratio => ({ x, n, ci: wilson(x, n) });
const fmt = (r: Ratio): string => (r.n === 0 ? `${String(r.x)}/0 (n/a)` : `${String(r.x)}/${String(r.n)} = ${(r.x / r.n).toFixed(2)} [${(r.ci ?? [0, 0])[0].toFixed(2)}, ${(r.ci ?? [0, 0])[1].toFixed(2)}]`);

interface EvidenceRow { functionId?: unknown; filePath?: unknown; target?: unknown; message?: unknown; discriminator?: unknown }

function readJson(p: string): unknown {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as unknown;
}
function rawRows(style: string, variant: string): ActualFinding[] {
  return (readJson(path.join(BASE, 'raw', style, `${variant}.json`)) as { findings: ActualFinding[] }).findings;
}
function evidenceRows(style: string, variant: string): EvidenceRow[] {
  const p = path.join(BASE, 'evidence', style, `${variant}.json`);
  return fs.existsSync(p) ? (readJson(p) as { violations: EvidenceRow[] }).violations : [];
}
/** The tool's message and relType for a row (first evidence row with the same rule, file and target). */
function describe(style: string, variant: string, m: { ruleId: string; file: string; target?: string }): { message: string; flowsTo: boolean } {
  const ev = evidenceRows(style, variant).find((v) => v.functionId === m.ruleId && v.filePath === m.file && ((v.target as string | undefined) ?? '') === (m.target ?? ''));
  const disc = Array.isArray(ev?.discriminator) ? (ev.discriminator as unknown[]).map(String) : [];
  return { message: typeof ev?.message === 'string' ? ev.message : '', flowsTo: m.ruleId === 'FF-P06' && disc[2] === 'FLOWS_TO' };
}

interface RuleScore {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly blocking: boolean;
  readonly violationVariants: number;
  readonly lookAlikes: number;
  readonly found: Ratio;
  readonly reportsRight: Ratio;
  /** Unexpected rows of the rule on violation variants (a row beyond the manifest). */
  readonly extraOnViolations: number;
  readonly falseAlarmsOnLookAlikes: number;
  readonly falseAlarmsOnClean: number;
}

interface Listed { readonly style: string; readonly variant: string; readonly role: Role; readonly mismatch: Mismatch; readonly message: string; readonly flowsTo: boolean }

interface StyleScore {
  readonly view: View;
  readonly style: string;
  readonly counts: { violation: number; lookAlike: number; clean: number; blockingExpected: number; blockingPerRule: Record<string, number> };
  readonly notPlanted: readonly { ruleId: string; reason: string }[];
  readonly rules: readonly RuleScore[];
  readonly blockingFound: Ratio;
  readonly blockingReportsRight: Ratio;
  readonly plantedDetected: Ratio;
  readonly lookAlikesSilent: Ratio;
  readonly lookAlikeFalseAlarmRows: number;
  readonly cleanSilent: Ratio;
  readonly cleanFalseAlarmRows: number;
  readonly baselineBlockingRows: number;
  readonly misses: readonly Listed[];
  readonly falseAlarms: readonly Listed[];
  readonly extras: readonly Listed[];
  readonly variants: readonly { variant: string; role: Role; rule: string | null; matched: number; missed: number; unexpected: number; unexpectedBlocking: number }[];
}

function scoreStyle(ref: LoadedReference, view: View): StyleScore {
  const roles = readJson(path.join(ref.dir, 'devset-b.json')) as RoleFile;
  const roleOf = (v: string): Role => {
    const r = roles.variants[v]?.role;
    if (r === undefined) throw new Error(`${ref.style}/${v}: no role in devset-b.json`);
    return r;
  };
  const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
  const blocking = new Set(ref.descriptor.scopeRules.filter((r) => r.blockingCandidate).map((r) => r.ruleId));
  const baselineActual = rawRows(ref.style, 'clean');
  const comps: { c: VariantComparison; role: Role; rule: string | null }[] = [];
  for (const v of ref.variants) {
    const role = roleOf(v.manifest.variant);
    if (role === 'baseline') continue;
    const raw = rawRows(ref.style, v.manifest.variant);
    const actual = view === 'literal' ? raw : containCycles(v.manifest.expectedFindings, raw);
    const c = compareVariant(ref.style, v.manifest, actual, scope, baselineActual);
    comps.push({ c, role, rule: roles.variants[v.manifest.variant]?.rule ?? null });
  }
  const listed = (pred: (role: Role, m: Mismatch) => boolean): Listed[] =>
    comps.flatMap(({ c, role }) => c.mismatches.filter((m) => blocking.has(m.ruleId) && pred(role, m)).map((m) => ({
      style: ref.style, variant: c.variant, role, mismatch: m, ...describe(ref.style, c.variant, m),
    })));

  const rules = ref.descriptor.scopeRules.map((r): RuleScore => {
    let tp = 0;
    let fn = 0;
    let fp = 0;
    let extra = 0;
    let faLook = 0;
    let faClean = 0;
    for (const { c, role } of comps) {
      tp += c.matched.filter((m) => m.ruleId === r.ruleId).length;
      for (const m of c.mismatches) {
        if (m.ruleId !== r.ruleId) continue;
        if (m.kind === 'missed') fn += 1;
        else {
          fp += 1;
          if (role === 'violation') extra += 1;
          else if (role === 'look-alike') faLook += 1;
          else faClean += 1;
        }
      }
    }
    return {
      ruleId: r.ruleId, ruleName: r.ruleName, blocking: r.blockingCandidate,
      violationVariants: comps.filter((x) => x.role === 'violation' && x.rule === r.ruleId).length,
      lookAlikes: comps.filter((x) => x.role === 'look-alike' && x.rule === r.ruleId).length,
      found: ratio(tp, tp + fn), reportsRight: ratio(tp, tp + fp),
      extraOnViolations: extra, falseAlarmsOnLookAlikes: faLook, falseAlarmsOnClean: faClean,
    };
  });
  const brules = rules.filter((r) => r.blocking);
  const sum = (f: (r: RuleScore) => number): number => brules.reduce((s, r) => s + f(r), 0);
  const violations = comps.filter((x) => x.role === 'violation');
  const looks = comps.filter((x) => x.role === 'look-alike');
  const cleans = comps.filter((x) => x.role === 'clean');
  const blockingUnexpected = (c: VariantComparison): number => c.mismatches.filter((m) => m.kind === 'unexpected' && blocking.has(m.ruleId)).length;
  const perRule: Record<string, number> = {};
  for (const id of blocking) perRule[id] = 0;
  for (const { c } of violations) for (const f of [...c.matched, ...c.mismatches.filter((m) => m.kind === 'missed')]) if (blocking.has(f.ruleId)) perRule[f.ruleId] = (perRule[f.ruleId] ?? 0) + 1;
  return {
    view,
    style: ref.style,
    counts: {
      violation: violations.length, lookAlike: looks.length, clean: cleans.length,
      blockingExpected: Object.values(perRule).reduce((s, n) => s + n, 0), blockingPerRule: perRule,
    },
    notPlanted: roles.notPlanted ?? [],
    rules,
    blockingFound: ratio(sum((r) => r.found.x), sum((r) => r.found.n)),
    blockingReportsRight: ratio(sum((r) => r.reportsRight.x), sum((r) => r.reportsRight.n)),
    plantedDetected: ratio(violations.filter((x) => x.c.plantedDetected === true).length, violations.length),
    lookAlikesSilent: ratio(looks.filter((x) => blockingUnexpected(x.c) === 0).length, looks.length),
    lookAlikeFalseAlarmRows: looks.reduce((s, x) => s + blockingUnexpected(x.c), 0),
    cleanSilent: ratio(cleans.filter((x) => blockingUnexpected(x.c) === 0).length, cleans.length),
    cleanFalseAlarmRows: cleans.reduce((s, x) => s + blockingUnexpected(x.c), 0),
    baselineBlockingRows: baselineActual.filter((a) => blocking.has(a.ruleId)).length,
    misses: listed((_, m) => m.kind === 'missed'),
    falseAlarms: listed((role, m) => m.kind === 'unexpected' && role !== 'violation'),
    extras: listed((role, m) => m.kind === 'unexpected' && role === 'violation'),
    variants: comps.map(({ c, role, rule }) => ({
      variant: c.variant, role, rule, matched: c.matched.length,
      missed: c.mismatches.filter((m) => m.kind === 'missed').length,
      unexpected: c.mismatches.filter((m) => m.kind === 'unexpected').length,
      unexpectedBlocking: blockingUnexpected(c),
    })),
  };
}

function render(byView: readonly (readonly StyleScore[])[]): string {
  const out: string[] = ['# v1.3 devset-b scores (development data, Claude-written)', ''];
  out.push('Blocking rules only unless stated. `found` = recall over planted expected findings; `reports right` = precision over every tool row of the rule on devset-b variants; Wilson 95% intervals. Views: see scripts/v1.3/devset-b-score.ts (literal; cycle-containment).', '');
  for (const scores of byView) renderView(out, scores);
  return out.join('\n') + '\n';
}

function renderView(out: string[], scores: readonly StyleScore[]): void {
  out.push(`# View: ${scores[0]?.view ?? ''}`, '');
  out.push('| Style | Violations | Look-alikes | Clean | Blocking expected | Found | Reports right | Planted rule detected | Look-alikes silent | Look-alike false-alarm rows | Clean silent | Clean false-alarm rows |');
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  const pool = { fx: 0, fn: 0, rx: 0, rn: 0 };
  for (const s of scores) {
    pool.fx += s.blockingFound.x; pool.fn += s.blockingFound.n; pool.rx += s.blockingReportsRight.x; pool.rn += s.blockingReportsRight.n;
    out.push(`| ${s.style} | ${String(s.counts.violation)} | ${String(s.counts.lookAlike)} | ${String(s.counts.clean)} | ${String(s.counts.blockingExpected)} | ${fmt(s.blockingFound)} | ${fmt(s.blockingReportsRight)} | ${fmt(s.plantedDetected)} | ${fmt(s.lookAlikesSilent)} | ${String(s.lookAlikeFalseAlarmRows)} | ${fmt(s.cleanSilent)} | ${String(s.cleanFalseAlarmRows)} |`);
  }
  out.push(`| **pooled** | | | | ${String(pool.fn)} | ${fmt(ratio(pool.fx, pool.fn))} | ${fmt(ratio(pool.rx, pool.rn))} | | | | | |`);
  for (const s of scores) {
    out.push('', `## ${s.style} (${s.view})`, '');
    out.push('| Rule | Name | Tier | Violation variants | Look-alikes | Found | Reports right | Extra rows on violations | False alarms (look-alike) | False alarms (clean) |');
    out.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const r of s.rules) {
      out.push(`| ${r.ruleId} | ${r.ruleName} | ${r.blocking ? 'blocking' : 'advisory'} | ${String(r.violationVariants)} | ${String(r.lookAlikes)} | ${fmt(r.found)} | ${fmt(r.reportsRight)} | ${String(r.extraOnViolations)} | ${String(r.falseAlarmsOnLookAlikes)} | ${String(r.falseAlarmsOnClean)} |`);
    }
    if (s.notPlanted.length > 0) out.push('', ...s.notPlanted.map((n) => `Not planted: ${n.ruleId}: ${n.reason}`));
    const line = (l: Listed): string =>
      `| ${l.variant} | ${l.role} | ${l.mismatch.ruleId} | ${l.mismatch.file} | ${l.mismatch.target ?? ''} | ${l.mismatch.alsoOnClean === true ? 'yes' : ''} | ${(l.mismatch.reason ?? l.message).replace(/\|/g, '\\|')}${l.flowsTo ? ' (FLOWS_TO)' : ''} |`;
    const table = (title: string, rows: readonly Listed[]): void => {
      out.push('', `### ${title} (${String(rows.length)})`, '');
      if (rows.length === 0) return void out.push('None.');
      out.push('| Variant | Role | Rule | File | Target | Also on baseline | Manifest reason / tool message |', '|---|---|---|---|---|---|---|');
      out.push(...rows.map(line));
    };
    table('Blocking misses', s.misses);
    table('Blocking false alarms (look-alike and clean variants)', s.falseAlarms);
    table('Blocking rows beyond the manifest on violation variants', s.extras);
  }
  out.push('');
}

const refs = loadAllReferences(ROOT, undefined, DEVSET_B_ROOT);
const byView = VIEWS.map((view) => refs.map((ref) => scoreStyle(ref, view)));
fs.writeFileSync(path.join(BASE, 'scores.json'), JSON.stringify({ set: 'devset-b', views: Object.fromEntries(VIEWS.map((v, i) => [v, byView[i]])) }, null, 2) + '\n');
fs.writeFileSync(path.join(BASE, 'scores.md'), render(byView));
process.stdout.write(render(byView));
