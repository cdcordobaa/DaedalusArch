/**
 * v1.3 K2: spec-author reliability on the external set (Docs/DiagnosticRuns/v1.3-spec-author-plan.md).
 *
 *   labels  --selection <selection.json> --repos <dir> --specs <dir> --out <file.json>
 *     Every git-tracked `.ts` file under each repo's analysis root (no `node_modules/`, `dist/`, `*.d.ts`) labelled
 *     with the spec's layer (resolveLayer: the layer annotator's first-match rule), `excluded` (spec
 *     `default_exclude_paths`) or `unmapped`; plus each layer's resolved kind.
 *
 *   compare --a <labels-a.json> --b <labels-b.json> [--eval-a <dir>] [--eval-b <dir>] --out <dir>
 *     Cohen's kappa over files per repo (primary: layer names, or kinds when the name sets differ; secondary: kinds
 *     always, and mapped-both only), disagreement classes, and, with evaluation outputs, blocking-count and verdict
 *     agreement (Spearman, Bland-Altman, verdict kappa). Writes agreement.json and agreement.md.
 *
 * Pure measurement tooling: no LLM call, no construct switch, nothing under the hold-out.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import { parseSpec } from '../../src/spec-parser/spec-parser.js';
import { readSpecExcludePaths } from '../../src/spec-parser/exclude-paths.js';
import { resolveLayer } from '../../src/mcp-server/layer-resolver.js';

interface Entry { readonly id: string; readonly root: string }
interface RepoLabels {
  readonly id: string;
  readonly layerNames: string[];
  readonly kinds: Record<string, string>;
  readonly files: Record<string, string>;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function need(name: string): string {
  const v = arg(name);
  if (v === undefined) throw new Error(`--${name} is required`);
  return v;
}

export function trackedTsFiles(repoDir: string, root: string): string[] {
  const out = execFileSync('git', ['-C', path.join(repoDir, root), 'ls-files', '--', '.'], { encoding: 'utf-8' });
  return out.split('\n').filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .filter((f) => !/(^|\/)(node_modules|dist)\//.test(f)).sort();
}

async function labelRepo(specFile: string, repoDir: string, root: string, id: string): Promise<RepoLabels> {
  const parsed = await parseSpec({ specFilePath: specFile });
  if (!parsed.success) throw new Error(`${id}: spec parse failed: ${parsed.errors.map((e) => e.message).join('; ')}`);
  const spec = parsed.data;
  const excluded = picomatch(readSpecExcludePaths(specFile), { dot: true });
  const files: Record<string, string> = {};
  for (const f of trackedTsFiles(repoDir, root)) {
    if (excluded(f)) files[f] = 'excluded';
    else files[f] = resolveLayer(spec, f)?.layer ?? 'unmapped';
  }
  const kinds: Record<string, string> = {};
  for (const l of spec.layerModel.layers) kinds[l.name] = String(l.kind);
  return { id, layerNames: spec.layerModel.layers.map((l) => l.name), kinds, files };
}

async function labels(): Promise<void> {
  const selection = JSON.parse(fs.readFileSync(need('selection'), 'utf-8')) as { entries: Entry[] };
  const repos = need('repos');
  const specs = need('specs');
  const out: RepoLabels[] = [];
  for (const e of selection.entries) {
    out.push(await labelRepo(path.join(specs, `${e.id}.yaml`), path.join(repos, e.id), e.root, e.id));
  }
  fs.writeFileSync(need('out'), JSON.stringify(out, null, 1) + '\n');
  for (const r of out) {
    const counts: Record<string, number> = {};
    for (const v of Object.values(r.files)) counts[v] = (counts[v] ?? 0) + 1;
    process.stdout.write(`${r.id}: ${JSON.stringify(counts)}\n`);
  }
}

// ── agreement statistics ────────────────────────────────────────────────────

/** Cohen's kappa of two label vectors; `null` when expected agreement is 1 (a single label). */
export function cohenKappa(a: readonly string[], b: readonly string[]): { kappa: number | null; po: number; pe: number; n: number } {
  const n = a.length;
  if (n === 0) return { kappa: null, po: 0, pe: 0, n };
  let agree = 0;
  const ca = new Map<string, number>();
  const cb = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) agree++;
    ca.set(a[i]!, (ca.get(a[i]!) ?? 0) + 1);
    cb.set(b[i]!, (cb.get(b[i]!) ?? 0) + 1);
  }
  const po = agree / n;
  let pe = 0;
  for (const [k, v] of ca) pe += (v / n) * ((cb.get(k) ?? 0) / n);
  return { kappa: pe >= 1 ? null : (po - pe) / (1 - pe), po, pe, n };
}

function ranks(xs: readonly number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++;
    for (let k = i; k <= j; k++) r[idx[k]![1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
function pearson(x: readonly number[], y: readonly number[]): number | null {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i]! - mx) * (y[i]! - my); sxx += (x[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}
export function spearman(x: readonly number[], y: readonly number[]): number | null { return pearson(ranks(x), ranks(y)); }

type ReasonClass = 'directory-choice' | 'mapped-vs-unmapped' | 'excluded-vs-included' | 'role-naming';
function reasonClass(la: string, lb: string, kindA: string | undefined, kindB: string | undefined): ReasonClass {
  if (la === 'excluded' || lb === 'excluded') return 'excluded-vs-included';
  if (la === 'unmapped' || lb === 'unmapped') return 'mapped-vs-unmapped';
  return kindA !== undefined && kindA === kindB ? 'role-naming' : 'directory-choice';
}

interface EvalSummary { blocking: number; perRule: Record<string, number>; verdict: string }
/** Blocking count, per-rule blocking and verdict from a `firewall evaluate --format json` output. */
export function summariseEvaluation(json: unknown): EvalSummary {
  const r = json as { violations?: { functionId?: string; tier?: string; blocking?: boolean }[]; verdict?: string; scoring?: { verdict?: string; blockingCount?: number } };
  const vs = (r.violations ?? []).filter((v) => v.blocking === true || v.tier === 'blocking');
  const perRule: Record<string, number> = {};
  for (const v of vs) perRule[String(v.functionId)] = (perRule[String(v.functionId)] ?? 0) + 1;
  return { blocking: r.scoring?.blockingCount ?? vs.length, perRule, verdict: String(r.scoring?.verdict ?? r.verdict ?? 'unknown') };
}

async function compare(): Promise<void> {
  const A = JSON.parse(fs.readFileSync(need('a'), 'utf-8')) as RepoLabels[];
  const B = JSON.parse(fs.readFileSync(need('b'), 'utf-8')) as RepoLabels[];
  const outDir = need('out');
  const evalA = arg('eval-a');
  const evalB = arg('eval-b');
  fs.mkdirSync(outDir, { recursive: true });
  const kindOf = (r: RepoLabels, l: string): string => (l === 'excluded' || l === 'unmapped' ? l : r.kinds[l] ?? l);
  const rows = [];
  const pooledA: string[] = [];
  const pooledB: string[] = [];
  for (const b of B) {
    const a = A.find((x) => x.id === b.id);
    if (a === undefined) throw new Error(`${b.id}: missing in A`);
    const files = Object.keys(b.files).filter((f) => f in a.files).sort();
    const onlyOne = [...Object.keys(a.files), ...Object.keys(b.files)].filter((f) => !(f in a.files && f in b.files));
    const sameNames = [...a.layerNames].sort().join('|') === [...b.layerNames].sort().join('|');
    const la = files.map((f) => a.files[f]!);
    const lb = files.map((f) => b.files[f]!);
    const ka = la.map((l) => kindOf(a, l));
    const kb = lb.map((l) => kindOf(b, l));
    const primary = sameNames ? cohenKappa(la, lb) : cohenKappa(ka, kb);
    pooledA.push(...(sameNames ? la : ka).map((l) => `${b.id}:${l}`));
    pooledB.push(...(sameNames ? lb : kb).map((l) => `${b.id}:${l}`));
    const mappedIdx = files.map((_, i) => i).filter((i) => !['excluded', 'unmapped'].includes(la[i]!) && !['excluded', 'unmapped'].includes(lb[i]!));
    const mappedBoth = cohenKappa(mappedIdx.map((i) => (sameNames ? la : ka)[i]!), mappedIdx.map((i) => (sameNames ? lb : kb)[i]!));
    const disagreements = files.flatMap((f, i) => (la[i] === lb[i] ? [] : [{
      file: f, a: la[i]!, b: lb[i]!, reason: reasonClass(la[i]!, lb[i]!, ka[i], kb[i]),
    }]));
    const reasons: Record<string, number> = {};
    for (const d of disagreements) reasons[d.reason] = (reasons[d.reason] ?? 0) + 1;
    const ev: Record<string, EvalSummary | null> = { a: null, b: null };
    for (const [side, dir] of [['a', evalA], ['b', evalB]] as const) {
      const p = dir !== undefined ? path.join(dir, `${b.id}.json`) : undefined;
      if (p !== undefined && fs.existsSync(p)) ev[side] = summariseEvaluation(JSON.parse(fs.readFileSync(p, 'utf-8')));
    }
    rows.push({
      id: b.id, files: files.length, filesInOneSetOnly: onlyOne.length, labelBasis: sameNames ? 'layer-name' : 'kind',
      primary, kind: cohenKappa(ka, kb), mappedBoth, reliable: primary.kappa !== null ? primary.kappa >= 0.8 : primary.po >= 0.8,
      reasons, disagreements, evalA: ev['a'], evalB: ev['b'],
    });
  }
  const pooled = cohenKappa(pooledA, pooledB);
  const reliableRepos = rows.filter((r) => r.reliable).length;
  const withEval = rows.filter((r) => r.evalA !== null && r.evalB !== null);
  const diffs = withEval.map((r) => r.evalB!.blocking - r.evalA!.blocking);
  const meanDiff = diffs.length > 0 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : null;
  const sdDiff = diffs.length > 1 && meanDiff !== null ? Math.sqrt(diffs.reduce((s, v) => s + (v - meanDiff) ** 2, 0) / (diffs.length - 1)) : null;
  const verdictKappa = cohenKappa(withEval.map((r) => r.evalA!.verdict), withEval.map((r) => r.evalB!.verdict));
  const summary = {
    pooledKappa: pooled, reliableRepos, repos: rows.length,
    instrumentReliable: pooled.kappa !== null && pooled.kappa >= 0.8 && reliableRepos >= 12,
    blocking: withEval.length === 0 ? null : {
      repos: withEval.length,
      spearman: spearman(withEval.map((r) => r.evalA!.blocking), withEval.map((r) => r.evalB!.blocking)),
      meanDiffBminusA: meanDiff, sdDiff,
      loa: meanDiff !== null && sdDiff !== null ? [meanDiff - 1.96 * sdDiff, meanDiff + 1.96 * sdDiff] : null,
      verdictSame: withEval.filter((r) => r.evalA!.verdict === r.evalB!.verdict).length, verdictKappa,
    },
  };
  fs.writeFileSync(path.join(outDir, 'agreement.json'), JSON.stringify({ summary, rows }, null, 1) + '\n');
  const f2 = (x: number | null | undefined): string => (x === null || x === undefined ? 'n/a' : x.toFixed(2));
  const md = [
    '# K2 agreement tables (generated by scripts/v1.3/spec-author-agreement.ts)', '',
    `Pooled file-to-layer kappa: ${f2(pooled.kappa)} (raw agreement ${f2(pooled.po)}, n = ${pooled.n}); repos with kappa >= 0.80: ${reliableRepos}/${rows.length}; instrument-level criterion met: ${summary.instrumentReliable ? 'yes' : 'no'}.`, '',
    '| repo | files | basis | kappa (primary) | raw agr. | kappa (kind) | kappa (mapped both) | reliable | disagreement classes |',
    '|---|---:|---|---:|---:|---:|---:|---|---|',
    ...rows.map((r) => `| ${r.id} | ${r.files} | ${r.labelBasis} | ${f2(r.primary.kappa)} | ${f2(r.primary.po)} | ${f2(r.kind.kappa)} | ${f2(r.mappedBoth.kappa)} (n=${r.mappedBoth.n}) | ${r.reliable ? 'yes' : 'no'} | ${Object.entries(r.reasons).map(([k, v]) => `${k} ${v}`).join(', ') || '-'} |`),
    '',
  ];
  if (summary.blocking !== null) {
    md.push('## Blocking counts and verdicts (same tool commit, cypher-interp, --scoring v1.3)', '',
      '| repo | blocking A | blocking B | B - A | verdict A | verdict B |', '|---|---:|---:|---:|---|---|',
      ...withEval.map((r) => `| ${r.id} | ${r.evalA!.blocking} | ${r.evalB!.blocking} | ${r.evalB!.blocking - r.evalA!.blocking} | ${r.evalA!.verdict} | ${r.evalB!.verdict} |`),
      '', `Spearman rho (A vs B blocking, ${withEval.length} repos): ${f2(summary.blocking.spearman)}. Bland-Altman: mean B - A = ${f2(meanDiff)}, SD = ${f2(sdDiff)}, 95 % limits of agreement = [${summary.blocking.loa ? summary.blocking.loa.map(f2).join(', ') : 'n/a'}]. Same verdict: ${summary.blocking.verdictSame}/${withEval.length}; verdict kappa ${f2(verdictKappa.kappa)}.`, '');
  }
  fs.writeFileSync(path.join(outDir, 'agreement.md'), md.join('\n'));
  process.stdout.write(md.join('\n') + '\n');
}

const mode = process.argv[2];
(mode === 'labels' ? labels() : mode === 'compare' ? compare() : Promise.reject(new Error('mode: labels | compare')))
  .catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`); process.exitCode = 1; });
