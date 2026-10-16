/**
 * Synthetic pull requests for the diff-aware gate (`check --base --head`, Docs/v1.3/ci-gate.md), built from the 71
 * reference variants (tests/fixtures/v1.3-reference).
 *
 * Per style, one git repository holds the spec at `spec.yaml` and the project at `project/`:
 *   - commit `clean`: the clean project;
 *   - commit `drift`: the clean project with two comment lines prepended to every source file (every line moves, no
 *     code changes);
 *   - one commit per violating or near-miss variant, each a child of `clean`, and a line-drift child of each.
 *
 * Cases per variant (the gate runs through `runCheck`, the code path of the CLI command):
 *   - violation / near-miss, `clean -> variant`: the NEW blocking findings must be exactly the manifest's blocking
 *     findings (none for a near-miss);
 *   - violation / near-miss, `variant -> clean`: the FIXED blocking findings must be exactly the manifest's blocking
 *     findings, and nothing may be NEW blocking;
 *   - clean, `clean -> drift`: nothing new and nothing fixed, in any tier;
 *   - violation / near-miss, `variant -> drift`: the variant with the same line drift; nothing new and nothing fixed.
 *
 * Matching against the manifest is the reference runner's (`compare.ts`: rule + file, target when both carry one,
 * cycles by their set of files). The manifests are never edited.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runCheck } from '../../../src/ci-gate/run-check.js';
import type { GateEngine } from '../../../src/ci-gate/engines.js';
import type { GateFinding, GateResult } from '../../../src/ci-gate/types.js';
import type { EngineEvaluation } from '../../../src/ci-gate/engines.js';
import { compareVariant } from './compare.js';
import type { ActualFinding, Mismatch } from './compare.js';
import { materialiseVariant } from './materialise.js';
import type { ExpectedFinding, LoadedReference, LoadedVariant, VariantKind } from './reference-model.js';

export type SyntheticDirection = 'clean->variant' | 'variant->clean' | 'clean->drift' | 'variant->drift';

export interface SyntheticCase {
  readonly style: string;
  readonly variant: string;
  readonly kind: VariantKind;
  readonly direction: SyntheticDirection;
  /** The manifest's blocking findings the case expects (as NEW for clean->variant, as FIXED for variant->clean). */
  readonly expected: number;
  readonly matched: number;
  /** Missed blocking findings; `reportedAs` names the tier the gate gave the row when it reported it in another tier. */
  readonly missed: readonly (Mismatch & { readonly reportedAs?: string })[];
  readonly unexpected: readonly Mismatch[];
  /** Blocking findings on the wrong side (NEW blocking in variant->clean; anything new or fixed in clean->drift). */
  readonly wrongSide: readonly GateFinding[];
  readonly exact: boolean;
  readonly verdict: GateResult['verdict'];
  readonly counts: { readonly new: number; readonly fixed: number; readonly unchanged: number; readonly unchangedMoved: number };
}

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'ci-gate-synthetic',
  GIT_AUTHOR_EMAIL: 'ci-gate@example.invalid',
  GIT_COMMITTER_NAME: 'ci-gate-synthetic',
  GIT_COMMITTER_EMAIL: 'ci-gate@example.invalid',
  GIT_CONFIG_NOSYSTEM: '1',
};

function git(repo: string, args: readonly string[]): string {
  const r = spawnSync('git', ['-C', repo, '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { env: GIT_ENV, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function replaceProject(repo: string, from: string): void {
  const dest = path.join(repo, 'project');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(from, dest, { recursive: true });
}

function commitAll(repo: string, message: string): string {
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '--allow-empty', '-m', message]);
  return git(repo, ['rev-parse', 'HEAD']);
}

const SOURCE_RE = /\.(?:[cm]?[jt]sx?)$/;

/** Prepends two comment lines to every source file under `dir` (not `.d.ts`): every line moves, no code changes. */
export function addLineDrift(dir: string): number {
  let n = 0;
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') walk(p);
      } else if (SOURCE_RE.test(e.name) && !/\.d\.[cm]?ts$/.test(e.name)) {
        fs.writeFileSync(p, `// ci-gate synthetic line drift\n// (no code change)\n${fs.readFileSync(p, 'utf8')}`);
        n += 1;
      }
    }
  };
  walk(dir);
  return n;
}

export interface StyleRepo {
  readonly repo: string;
  readonly clean: string;
  readonly drift: string;
  /** Variant id -> commit (violations and near-misses). */
  readonly variants: ReadonlyMap<string, string>;
  /** Variant id -> the variant's line-drift commit. */
  readonly variantDrift: ReadonlyMap<string, string>;
}

/** Builds the style's synthetic repository under `workRoot`. */
export function buildStyleRepo(ref: LoadedReference, workRoot: string): StyleRepo {
  const repo = path.join(workRoot, 'repos', ref.style);
  const scratch = path.join(workRoot, 'materialised');
  fs.rmSync(repo, { recursive: true, force: true });
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']);
  fs.copyFileSync(ref.specPath, path.join(repo, 'spec.yaml'));

  const cleanVariant = ref.variants.find((v) => v.manifest.kind === 'clean');
  if (cleanVariant === undefined) throw new Error(`${ref.style}: no clean variant`);
  replaceProject(repo, materialiseVariant(ref, cleanVariant, scratch).projectDir);
  const clean = commitAll(repo, `${ref.style}: clean`);

  addLineDrift(path.join(repo, 'project'));
  const drift = commitAll(repo, `${ref.style}: line drift`);

  const variants = new Map<string, string>();
  const variantDrift = new Map<string, string>();
  for (const v of ref.variants) {
    if (v === cleanVariant) continue;
    git(repo, ['checkout', '-q', '--detach', clean]);
    replaceProject(repo, materialiseVariant(ref, v, scratch).projectDir);
    variants.set(v.manifest.variant, commitAll(repo, `${ref.style}: ${v.manifest.variant}`));
    addLineDrift(path.join(repo, 'project'));
    variantDrift.set(v.manifest.variant, commitAll(repo, `${ref.style}: ${v.manifest.variant} line drift`));
  }
  git(repo, ['checkout', '-q', '--detach', clean]);
  return { repo, clean, drift, variants, variantDrift };
}

function asActual(rows: readonly GateFinding[]): ActualFinding[] {
  return rows.map((f) => ({ ruleId: f.ruleId, file: f.file, ...(f.target !== undefined ? { target: f.target } : {}) }));
}

export function blockingExpected(ref: LoadedReference, v: LoadedVariant): ExpectedFinding[] {
  const blocking = new Set(ref.descriptor.scopeRules.filter((r) => r.blockingCandidate).map((r) => r.ruleId));
  return v.manifest.expectedFindings.filter((f) => blocking.has(f.ruleId));
}

/** Scores the gate's blocking rows of one side against the manifest's blocking findings. */
export function scoreSide(
  ref: LoadedReference,
  v: LoadedVariant,
  direction: SyntheticDirection,
  result: GateResult,
): SyntheticCase {
  const unchangedMoved = result.unchanged.filter((u) => u.base.line !== u.head.line).length;
  const counts = { new: result.new.length, fixed: result.fixed.length, unchanged: result.unchanged.length, unchangedMoved };
  if (direction === 'clean->drift' || direction === 'variant->drift') {
    const wrongSide = [...result.new, ...result.fixed];
    return {
      style: ref.style, variant: v.manifest.variant, kind: v.manifest.kind, direction, expected: 0, matched: 0,
      missed: [], unexpected: [], wrongSide, exact: wrongSide.length === 0, verdict: result.verdict, counts,
    };
  }
  const side = direction === 'clean->variant' ? result.new : result.fixed;
  const other = direction === 'clean->variant' ? [] : result.new.filter((f) => f.tier === 'blocking');
  const actual = asActual(side.filter((f) => f.tier === 'blocking'));
  const expected = blockingExpected(ref, v);
  // Every rule id is scored: a blocking row outside the reference's compared rules is still an unexpected finding.
  const scope = new Set([...ref.descriptor.scopeRules.map((r) => r.ruleId), ...actual.map((a) => a.ruleId)]);
  const cmp = compareVariant(ref.style, { ...v.manifest, expectedFindings: expected }, actual, scope);
  // A missed finding the gate did report, in another tier (FF-P06 FLOWS_TO rows are `not-applicable`).
  const others = side.filter((f) => f.tier !== 'blocking');
  const missed = cmp.mismatches
    .filter((m) => m.kind === 'missed')
    .map((m) => {
      const one = { ...v.manifest, expectedFindings: [{ ruleId: m.ruleId, ruleName: '', file: m.file, ...(m.target !== undefined ? { target: m.target } : {}), reason: '' }] };
      const hit = others.find((o) => compareVariant(ref.style, one, asActual([o]), new Set([o.ruleId])).matched.length === 1);
      return hit === undefined ? m : { ...m, reportedAs: hit.tier };
    });
  const unexpected = cmp.mismatches.filter((m) => m.kind === 'unexpected');
  return {
    style: ref.style, variant: v.manifest.variant, kind: v.manifest.kind, direction, expected: expected.length,
    matched: cmp.matched.length, missed, unexpected, wrongSide: other,
    exact: missed.length === 0 && unexpected.length === 0 && other.length === 0, verdict: result.verdict, counts,
  };
}

/** Runs every case of `refs` with `engine`; each commit is evaluated once (the cache spans the style's cases). */
export async function runSynthetic(
  refs: readonly LoadedReference[],
  engine: GateEngine,
  workRoot: string,
  log: (text: string) => void = () => undefined,
): Promise<SyntheticCase[]> {
  const cases: SyntheticCase[] = [];
  for (const ref of refs) {
    const r = buildStyleRepo(ref, workRoot);
    const cache = new Map<string, EngineEvaluation>();
    const check = (base: string, head: string): Promise<GateResult> =>
      runCheck({ repo: r.repo, base, head, spec: 'spec.yaml', project: 'project', engine, cache });
    for (const v of ref.variants) {
      if (v.manifest.kind === 'clean') {
        const c = scoreSide(ref, v, 'clean->drift', await check(r.clean, r.drift));
        cases.push(c);
        log(`${ref.style}/${v.manifest.variant} clean->drift: ${c.exact ? 'exact' : 'MISMATCH'}\n`);
        continue;
      }
      const sha = r.variants.get(v.manifest.variant);
      if (sha === undefined) throw new Error(`${ref.style}/${v.manifest.variant}: no commit`);
      const drifted = r.variantDrift.get(v.manifest.variant) ?? sha;
      for (const [direction, base, head] of [['clean->variant', r.clean, sha], ['variant->clean', sha, r.clean], ['variant->drift', sha, drifted]] as const) {
        const c = scoreSide(ref, v, direction, await check(base, head));
        cases.push(c);
        log(`${ref.style}/${v.manifest.variant} ${direction}: ${c.exact ? 'exact' : 'MISMATCH'} (${String(c.matched)}/${String(c.expected)}, +${String(c.unexpected.length + c.wrongSide.length)})\n`);
      }
    }
  }
  return cases;
}

interface Tally {
  cases: number;
  exact: number;
  expected: number;
  tp: number;
  fn: number;
  fp: number;
}

function tally(cases: readonly SyntheticCase[]): Tally {
  return cases.reduce<Tally>(
    (t, c) => ({
      cases: t.cases + 1,
      exact: t.exact + (c.exact ? 1 : 0),
      expected: t.expected + c.expected,
      tp: t.tp + c.matched,
      fn: t.fn + c.missed.length,
      fp: t.fp + c.unexpected.length + c.wrongSide.length,
    }),
    { cases: 0, exact: 0, expected: 0, tp: 0, fn: 0, fp: 0 },
  );
}

const pct = (n: number, d: number): string => (d === 0 ? 'n/a' : `${(100 * n / d).toFixed(1)} %`);
const frac = (n: number, d: number): string => `${String(n)}/${String(d)}`;

function row(label: string, dir: string, t: Tally): string {
  return `| ${label} | ${dir} | ${String(t.cases)} | ${frac(t.exact, t.cases)} (${pct(t.exact, t.cases)}) | ${String(t.expected)} | ${String(t.tp)} | ${String(t.fn)} | ${String(t.fp)} | ${pct(t.tp, t.tp + t.fn)} | ${pct(t.tp, t.tp + t.fp)} |`;
}

/** The accuracy table and the list of inexact cases, as Markdown. */
export function renderSyntheticMarkdown(cases: readonly SyntheticCase[], header: string): string {
  const lines = [header, ''];
  lines.push(
    'A case is **exact** when the gate reports precisely the manifest\'s blocking findings on the expected side (NEW for clean→variant, FIXED for variant→clean) and nothing blocking on the other side; a drift case (every source file shifted by two comment lines) is exact when nothing at all, in any tier, is new or fixed. TP/FN/FP count blocking findings; FP includes rows on the wrong side.',
    '',
    '| Style | Direction | Cases | Exact | Expected | TP | FN | FP | Recall | Precision |',
    '|---|---|---|---|---|---|---|---|---|---|',
  );
  const styles = [...new Set(cases.map((c) => c.style))];
  const dirs: SyntheticDirection[] = ['clean->variant', 'variant->clean', 'clean->drift', 'variant->drift'];
  for (const s of styles) {
    for (const d of dirs) {
      const sel = cases.filter((c) => c.style === s && c.direction === d);
      if (sel.length > 0) lines.push(row(s, d.replace('->', '→'), tally(sel)));
    }
  }
  for (const d of dirs) {
    const sel = cases.filter((c) => c.direction === d);
    if (sel.length > 0) lines.push(row('**all**', d.replace('->', '→'), tally(sel)));
  }
  lines.push(row('**all**', '**all**', tally(cases)));

  const variants = new Set(cases.map((c) => `${c.style}/${c.variant}`));
  const allExact = [...variants].filter((k) => cases.filter((c) => `${c.style}/${c.variant}` === k).every((c) => c.exact)).length;
  lines.push('', `Variants with every case exact: **${frac(allExact, variants.size)}**.`);

  const drift = cases.filter((c) => c.direction === 'clean->drift' || c.direction === 'variant->drift');
  if (drift.length > 0) {
    const moved = drift.reduce((n, c) => n + c.counts.unchangedMoved, 0);
    const unchanged = drift.reduce((n, c) => n + c.counts.unchanged, 0);
    lines.push('', `Line drift: across the ${String(drift.length)} drift cases, ${String(unchanged)} findings were matched as unchanged, ${String(moved)} of them reported on a different line in head than in base.`);
  }

  const bad = cases.filter((c) => !c.exact);
  lines.push('', '## Inexact cases', '');
  if (bad.length === 0) lines.push('None.');
  else {
    lines.push('| Style | Variant | Direction | Missed | Unexpected / wrong side |', '|---|---|---|---|---|');
    const fmt = (m: { ruleId: string; file: string; target?: string; reportedAs?: string }): string =>
      `${m.ruleId} \`${m.file}\`${m.target !== undefined ? ` → \`${m.target}\`` : ''}${m.reportedAs !== undefined ? ` (reported, tier ${m.reportedAs})` : ''}`;
    for (const c of bad) {
      lines.push(`| ${c.style} | ${c.variant} | ${c.direction.replace('->', '→')} | ${c.missed.map(fmt).join('<br>') || '-'} | ${[...c.unexpected.map(fmt), ...c.wrongSide.map((f) => `${fmt(f)} (${f.tier}, wrong side)`)].join('<br>') || '-'} |`);
    }
  }
  return lines.join('\n') + '\n';
}
