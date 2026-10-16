/**
 * Rule mining evaluation (Docs/v1.3/rule-mining.md §1.4), offline (no Neo4j, no LLM). Entry file: no exports.
 *
 * (A) clean and near-miss variants: the mined allowed layer graph against the true spec's allowed-dependency graph
 *     (edge precision and recall), end to end (ISE layers) and with the oracle layer map (the true spec's), under the
 *     three rule sets observed / strict / full; the precision of each forbidding rule kind; the false exceptions.
 * (B) violating variants: each mined on its own; does each planted expected finding surface as an exception?
 * (C) the same on the rename probes (P1-P5, N1, N2, S).
 *
 * The miner sees only `snapshotSource(<materialised variant>)`. The ground truth (true spec, expected findings) is read
 * here, by the evaluator, and never passed to src/rule-mining.
 *
 * Usage (repository root): npx tsx scripts/v1.3/rule-mining-eval.ts [--out results/v1.3-rule-mining/2026-10-16]
 *   [--set dev|heldout|all] [--target id,id]
 * Writes <out>/eval.json, <out>/eval.md and <out>/specs/<target>.mined.yaml (the clean variant's emitted spec).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { annotate } from '../../src/ise/layer-mapper.js';
import { snapshotSource } from '../../src/ise/snapshot.js';
import { allowedGraph, analyseSnapshot, mineRules, proposeFromAnalysis } from '../../src/rule-mining/index.js';
import type { MinedRule, MinedRuleKind, MiningResult, MiningStyle } from '../../src/rule-mining/index.js';
import { parseSpec } from '../../src/spec-parser/index.js';
import { materialiseTarget, renamedFindings, targetSet, trueSpecText } from './lib/ise-targets.js';
import type { IseTarget } from './lib/ise-targets.js';
import { makeTempRoot } from './lib/materialise.js';
import { loadAllReferences } from './lib/reference-model.js';
import type { ExpectedFinding, LoadedReference } from './lib/reference-model.js';

const PRESETS = path.resolve('presets');
const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const OUT = path.resolve(arg('--out') ?? 'results/v1.3-rule-mining/2026-10-16');
const SETS = { observed: [] as MinedRuleKind[], strict: ['layer-direction', 'layer-unobserved'] as MinedRuleKind[], full: ['layer-direction', 'layer-unobserved', 'layer-rare-edge'] as MinedRuleKind[] };
type RuleSet = keyof typeof SETS;
const LAYER_KINDS: readonly MinedRuleKind[] = ['layer-direction', 'layer-rare-edge', 'layer-unobserved'];

interface TrueSpec {
  readonly style: string;
  readonly layers: { name: string; directories: string[]; filePatterns: string[] }[];
  readonly kinds: Map<string, string | undefined>;
  readonly allowedAll: string[];
}

async function readTrueSpec(text: string): Promise<TrueSpec> {
  const raw = YAML.parse(text) as { architecture: { style: string; layers: { name: string; directories?: string[]; file_patterns?: string[] }[]; allowed_dependencies?: { from: string; to: string[] }[] } };
  const a = raw.architecture;
  const names = a.layers.map((l) => l.name);
  let allowedAll: string[];
  if (a.allowed_dependencies !== undefined) allowedAll = a.allowed_dependencies.flatMap((e) => e.to.map((t) => `${e.from}>${t}`));
  else {
    allowedAll = [];
    for (let i = 0; i < names.length; i++) for (let j = 0; j < i; j++) if (a.style !== 'layered' || j === i - 1) allowedAll.push(`${String(names[i])}>${String(names[j])}`);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-true-'));
  const file = path.join(dir, 'spec.yaml');
  fs.writeFileSync(file, text);
  const parsed = await parseSpec({ specFilePath: file });
  fs.rmSync(dir, { recursive: true, force: true });
  if (!parsed.success) throw new Error(`true spec does not parse: ${parsed.errors.map((e) => e.message).join('; ')}`);
  return {
    style: a.style,
    layers: a.layers.map((l) => ({ name: l.name, directories: l.directories ?? [], filePatterns: l.file_patterns ?? [] })),
    kinds: new Map(parsed.data.layerModel.layers.map((l) => [l.name, l.kind])),
    allowedAll: allowedAll.sort(),
  };
}

interface Pr { tp: number; fp: number; fn: number }
const pr = (mined: readonly string[], truth: readonly string[]): Pr => {
  const t = new Set(truth);
  const m = new Set(mined);
  return { tp: [...m].filter((x) => t.has(x)).length, fp: [...m].filter((x) => !t.has(x)).length, fn: [...t].filter((x) => !m.has(x)).length };
};

interface ForbidCheck { kind: MinedRuleKind; total: number; correct: number }
function forbidPrecision(rules: readonly MinedRule[], truth: ReadonlySet<string>): ForbidCheck[] {
  return LAYER_KINDS.map((kind) => {
    const rs = rules.filter((r) => r.kind === kind);
    return { kind, total: rs.length, correct: rs.filter((r) => !truth.has(`${r.subject}>${String(r.object)}`)).length };
  });
}

interface Surface { finding: ExpectedFinding; exact: { rule: string; kind: MinedRuleKind; level: string; confidence: number } | null; fileLevel: { rule: string; kind: MinedRuleKind; level: string } | null }
function surfaces(findings: readonly ExpectedFinding[], rules: readonly MinedRule[]): { rows: Surface[]; noise: number; exceptions: number } {
  const rows = findings.map((f): Surface => {
    let exact: Surface['exact'] = null;
    let fileLevel: Surface['fileLevel'] = null;
    for (const r of [...rules].sort((a, b) => b.confidence - a.confidence)) {
      for (const e of r.exceptions) {
        if (e.file !== f.file) continue;
        fileLevel ??= { rule: r.id, kind: r.kind, level: r.level };
        if (exact === null && (f.target === undefined || e.target === f.target)) exact = { rule: r.id, kind: r.kind, level: r.level, confidence: r.confidence };
      }
    }
    return { finding: f, exact, fileLevel };
  });
  const planted = new Set(findings.map((f) => f.file));
  const all = rules.flatMap((r) => r.exceptions);
  return { rows, noise: all.filter((e) => !planted.has(e.file)).length, exceptions: all.length };
}

interface VariantRow {
  target: string;
  style: string;
  variant: string;
  kind: string;
  plants: string | null;
  iseStyle: string;
  specValid: boolean;
  specErrors: readonly string[];
  compiled: readonly string[];
  rules: { kind: MinedRuleKind; level: string; exceptions: number; representable: boolean }[];
  truth: string[];
  e2e: Record<RuleSet, { mined: string[]; pr: Pr }>;
  oracle: Record<RuleSet, { mined: string[]; pr: Pr }>;
  forbidE2e: ForbidCheck[];
  forbidOracle: ForbidCheck[];
  exceptionsE2e: number;
  exceptionsOracle: number;
  surfaceE2e: Surface[];
  surfaceOracle: Surface[];
  noiseE2e: number;
  noiseOracle: number;
  /** Every exception mined end to end: rule kind, level, file, target. */
  exceptionList: string[];
}

function graphs(m: MiningResult, truth: readonly string[]): Record<RuleSet, { mined: string[]; pr: Pr }> {
  const out = {} as Record<RuleSet, { mined: string[]; pr: Pr }>;
  for (const s of Object.keys(SETS) as RuleSet[]) {
    const mined = allowedGraph(m.pairs, m.rules, SETS[s]);
    out[s] = { mined, pr: pr(mined, truth) };
  }
  return out;
}

async function evalVariant(ref: LoadedReference, target: IseTarget, vi: number, work: string, specsDir: string): Promise<VariantRow> {
  const variant = ref.variants[vi];
  if (variant === undefined) throw new Error('no variant');
  const dir = materialiseTarget(ref, variant, target, path.join(work, String(vi)));
  const truthSpec = await readTrueSpec(trueSpecText(ref, target));
  const snap = snapshotSource(dir);
  try {
    const root = fs.realpathSync(snap.dir);
    const analysis = await analyseSnapshot(root, { presetsDir: PRESETS });
    const proposal = await proposeFromAnalysis(analysis, { presetsDir: PRESETS });
    if (variant.manifest.kind === 'clean') fs.writeFileSync(path.join(specsDir, `${target.id}.mined.yaml`), proposal.specYaml);
    // Oracle: the same graph and components, the true spec's layer map and kinds.
    const trueAssign = annotate(analysis.graph.files, truthSpec.layers);
    const oracleLayerOf = new Map([...trueAssign].map(([f, a]) => [f, a.layer]));
    const oracle = mineRules({ ...analysis.input, layerOf: oracleLayerOf, layers: truthSpec.layers.map((l) => l.name), layerKinds: truthSpec.kinds }, truthSpec.style as MiningStyle);
    const present = new Set([...oracleLayerOf.values()].filter((l): l is string => l !== null));
    const truth = truthSpec.allowedAll.filter((e) => { const [a, b] = e.split('>'); return present.has(a ?? '') && present.has(b ?? ''); });
    const truthSet = new Set(truth);
    const findings = renamedFindings(variant.manifest.expectedFindings, target);
    const sE = surfaces(findings, proposal.mining.rules);
    const sO = surfaces(findings, oracle.rules);
    return {
      target: target.id, style: ref.style, variant: variant.manifest.variant, kind: variant.manifest.kind, plants: variant.manifest.plants,
      iseStyle: proposal.style, specValid: proposal.check.valid, specErrors: proposal.check.errors, compiled: proposal.check.compiled,
      rules: proposal.mining.rules.map((r) => ({ kind: r.kind, level: r.level, exceptions: r.exceptions.length, representable: r.compilesTo !== null })),
      truth,
      e2e: graphs(proposal.mining, truth),
      oracle: graphs(oracle, truth),
      forbidE2e: forbidPrecision(proposal.mining.rules, truthSet),
      forbidOracle: forbidPrecision(oracle.rules, truthSet),
      exceptionsE2e: sE.exceptions, exceptionsOracle: sO.exceptions,
      surfaceE2e: sE.rows, surfaceOracle: sO.rows, noiseE2e: sE.noise, noiseOracle: sO.noise,
      exceptionList: proposal.mining.rules.flatMap((r) => r.exceptions.map((e) => `${r.kind} ${r.level} ${r.subject}${r.object !== undefined ? `>${r.object}` : ''}: ${e.file}${e.target !== undefined ? ` -> ${e.target}` : ''}`)),
    };
  } finally {
    snap.dispose();
  }
}

// ── Report ─────────────────────────────────────────────────────────────────────

const pct = (a: number, b: number): string => (b === 0 ? 'n/a' : `${(100 * a / b).toFixed(0)}%`);
const sumPr = (xs: readonly Pr[]): Pr => xs.reduce((s, x) => ({ tp: s.tp + x.tp, fp: s.fp + x.fp, fn: s.fn + x.fn }), { tp: 0, fp: 0, fn: 0 });
const fmtPr = (p: Pr): string => `${pct(p.tp, p.tp + p.fp)} / ${pct(p.tp, p.tp + p.fn)} (${String(p.tp)}/${String(p.tp + p.fp)}, ${String(p.tp)}/${String(p.tp + p.fn)})`;

function report(rows: readonly VariantRow[], targets: readonly IseTarget[]): string {
  const out: string[] = ['# Rule mining evaluation', '', `Generated by scripts/v1.3/rule-mining-eval.ts. ${String(rows.length)} variants, ${String(targets.length)} targets.`, ''];
  const groups: [string, (t: string) => boolean][] = [
    ['5 reference projects', (t) => !/^(P\d|N\d|S)-/.test(t)],
    ['P1-P5 (development rename probe)', (t) => /^P\d-/.test(t)],
    ['N1 (rename probe)', (t) => t.startsWith('N1-')],
    ['N2 (rename probe)', (t) => t.startsWith('N2-')],
    ['S (rename probe, scrambled suffixes)', (t) => t.startsWith('S-')],
  ];
  out.push('## (A) Clean variants: mined allowed graph vs the true spec (precision / recall, pooled)', '');
  for (const kind of ['clean', 'near-miss'] as const) {
    out.push(`### ${kind} variants`, '', '| Targets | Variants | Layers | observed | strict | full (default) |', '|---|---|---|---|---|---|');
    for (const [name, f] of groups) {
      const rs = rows.filter((r) => r.kind === kind && f(r.target));
      if (rs.length === 0) continue;
      for (const lm of ['e2e', 'oracle'] as const) {
        out.push(`| ${name} | ${String(rs.length)} | ${lm === 'e2e' ? 'ISE' : 'oracle'} | ${(['observed', 'strict', 'full'] as RuleSet[]).map((s) => fmtPr(sumPr(rs.map((r) => r[lm][s].pr)))).join(' | ')} |`);
      }
    }
    out.push('');
  }
  out.push('### Per target, clean variant, end to end (full)', '', '| Target | ISE style | True edges | Mined edges | Precision | Recall | Missing (true, not mined) | Extra (mined, not true) |', '|---|---|---|---|---|---|---|---|');
  for (const r of rows.filter((x) => x.kind === 'clean')) {
    const m = r.e2e.full.mined;
    const t = new Set(r.truth);
    out.push(`| ${r.target} | ${r.iseStyle} | ${String(r.truth.length)} | ${String(m.length)} | ${pct(r.e2e.full.pr.tp, m.length)} | ${pct(r.e2e.full.pr.tp, r.truth.length)} | ${r.truth.filter((x) => !m.includes(x)).join(', ') || '-'} | ${m.filter((x) => !t.has(x)).join(', ') || '-'} |`);
  }
  out.push('', '### Forbidding rules: share of "A must not depend on B" rules that the true spec also forbids (clean variants)', '', '| Targets | Layers | layer-direction | layer-rare-edge | layer-unobserved |', '|---|---|---|---|---|');
  for (const [name, f] of groups) {
    const rs = rows.filter((r) => r.kind === 'clean' && f(r.target));
    if (rs.length === 0) continue;
    for (const lm of ['forbidE2e', 'forbidOracle'] as const) {
      const cell = (k: MinedRuleKind): string => { const xs = rs.flatMap((r) => r[lm].filter((c) => c.kind === k)); const c = xs.reduce((s, x) => s + x.correct, 0); const t = xs.reduce((s, x) => s + x.total, 0); return `${String(c)}/${String(t)}`; };
      out.push(`| ${name} | ${lm === 'forbidE2e' ? 'ISE' : 'oracle'} | ${cell('layer-direction')} | ${cell('layer-rare-edge')} | ${cell('layer-unobserved')} |`);
    }
  }
  out.push('', '### False alarms: exceptions mined on variants with no planted violation', '', '| Targets | Variants (clean + near-miss) | Exceptions (ISE) | Exceptions (oracle) | Variants with none (ISE) |', '|---|---|---|---|---|');
  for (const [name, f] of groups) {
    const rs = rows.filter((r) => r.kind !== 'violation' && f(r.target));
    if (rs.length === 0) continue;
    out.push(`| ${name} | ${String(rs.length)} | ${String(rs.reduce((s, r) => s + r.exceptionsE2e, 0))} | ${String(rs.reduce((s, r) => s + r.exceptionsOracle, 0))} | ${String(rs.filter((r) => r.exceptionsE2e === 0).length)} |`);
  }
  out.push('', '## (B) Violating variants: planted findings surfacing as exceptions', '', '| Targets | Violating variants | Planted findings | Exact (ISE) | File level (ISE) | Exact (oracle) | Variants with >= 1 exact (ISE) | Noise exceptions per variant (ISE) |', '|---|---|---|---|---|---|---|---|');
  for (const [name, f] of groups) {
    const rs = rows.filter((r) => r.kind === 'violation' && f(r.target));
    if (rs.length === 0) continue;
    const fs_ = rs.flatMap((r) => r.surfaceE2e);
    const fo = rs.flatMap((r) => r.surfaceOracle);
    out.push(`| ${name} | ${String(rs.length)} | ${String(fs_.length)} | ${String(fs_.filter((s) => s.exact !== null).length)} (${pct(fs_.filter((s) => s.exact !== null).length, fs_.length)}) | ${String(fs_.filter((s) => s.fileLevel !== null).length)} | ${String(fo.filter((s) => s.exact !== null).length)} | ${String(rs.filter((r) => r.surfaceE2e.some((s) => s.exact !== null)).length)} | ${(rs.reduce((s, r) => s + r.noiseE2e, 0) / rs.length).toFixed(1)} |`);
  }
  out.push('', '### By planted rule (5 reference projects, end to end)', '', '| Planted rule | Findings | Exact | File level | Surfaced by (kind: count) |', '|---|---|---|---|---|');
  const byRule = new Map<string, Surface[]>();
  for (const r of rows.filter((x) => x.kind === 'violation' && !/^(P\d|N\d|S)-/.test(x.target))) for (const s of r.surfaceE2e) byRule.set(s.finding.ruleId, [...(byRule.get(s.finding.ruleId) ?? []), s]);
  for (const [rule, ss] of [...byRule].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const kinds = new Map<string, number>();
    for (const s of ss) if (s.exact !== null) kinds.set(`${s.exact.kind} (${s.exact.level})`, (kinds.get(`${s.exact.kind} (${s.exact.level})`) ?? 0) + 1);
    out.push(`| ${rule} | ${String(ss.length)} | ${String(ss.filter((s) => s.exact !== null).length)} | ${String(ss.filter((s) => s.fileLevel !== null).length)} | ${[...kinds].map(([k, n]) => `${k}: ${String(n)}`).join(', ') || '-'} |`);
  }
  out.push('', '### Per violating variant (5 reference projects, end to end)', '', '| Target | Variant | Plants | Exact | Surfaced by | Exceptions | Noise |', '|---|---|---|---|---|---|---|');
  for (const r of rows.filter((x) => x.kind === 'violation' && !/^(P\d|N\d|S)-/.test(x.target))) {
    const ex = r.surfaceE2e.filter((s) => s.exact !== null);
    out.push(`| ${r.target} | ${r.variant} | ${r.plants ?? '-'} | ${String(ex.length)}/${String(r.surfaceE2e.length)} | ${ex.map((s) => `${String(s.exact?.kind)} ${String(s.exact?.level)} ${String(s.exact?.confidence)}`).join('; ') || '-'} | ${String(r.exceptionsE2e)} | ${String(r.noiseE2e)} |`);
  }
  out.push('', '### Exceptions on variants with no planted violation (5 reference projects, end to end)', '', '| Target | Variant | Exception |', '|---|---|---|');
  for (const r of rows.filter((x) => x.kind !== 'violation' && !/^(P\d|N\d|S)-/.test(x.target))) for (const e of r.exceptionList) out.push(`| ${r.target} | ${r.variant} | ${e} |`);
  out.push('', '## Emitted specs', '', '| Targets | Variants | Spec valid and compiles | ISE style correct |', '|---|---|---|---|');
  for (const [name, f] of groups) {
    const rs = rows.filter((r) => f(r.target));
    if (rs.length === 0) continue;
    out.push(`| ${name} | ${String(rs.length)} | ${String(rs.filter((r) => r.specValid).length)} | ${String(rs.filter((r) => r.iseStyle === r.style).length)} |`);
  }
  const kinds = new Map<string, { n: number; rep: number; byLevel: Record<string, number> }>();
  for (const r of rows.filter((x) => x.kind === 'clean')) for (const k of r.rules) {
    const e = kinds.get(k.kind) ?? { n: 0, rep: 0, byLevel: { high: 0, medium: 0, low: 0 } };
    e.n++; if (k.representable) e.rep++; e.byLevel[k.level] = (e.byLevel[k.level] ?? 0) + 1;
    kinds.set(k.kind, e);
  }
  out.push('', '### Rules mined on the clean variants (all targets), by kind', '', '| Kind | Rules | high / medium / low | Representable in the existing templates |', '|---|---|---|---|');
  for (const [k, e] of [...kinds].sort(([a], [b]) => (a < b ? -1 : 1))) out.push(`| ${k} | ${String(e.n)} | ${String(e.byLevel.high)} / ${String(e.byLevel.medium)} / ${String(e.byLevel.low)} | ${String(e.rep)} |`);
  return out.join('\n') + '\n';
}

async function main(): Promise<void> {
  const only = arg('--target')?.split(',');
  const targets = targetSet(argv.includes('--set') ? argv : ['--set', 'all']).filter((t) => only === undefined || only.includes(t.id));
  const refs = loadAllReferences(process.cwd());
  const specsDir = path.join(OUT, 'specs');
  fs.mkdirSync(specsDir, { recursive: true });
  const work = makeTempRoot('rule-mining-');
  const rows: VariantRow[] = [];
  try {
    for (const target of targets) {
      const ref = refs.find((r) => r.style === target.style);
      if (ref === undefined) throw new Error(`no reference ${target.style}`);
      const t0 = Date.now();
      for (let vi = 0; vi < ref.variants.length; vi++) rows.push(await evalVariant(ref, target, vi, path.join(work, target.id), specsDir));
      process.stderr.write(`${target.id}: ${String(ref.variants.length)} variants, ${String(Date.now() - t0)} ms\n`);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(OUT, 'eval.json'), JSON.stringify({ generatedBy: 'scripts/v1.3/rule-mining-eval.ts', targets: targets.map((t) => t.id), rows }, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT, 'eval.md'), report(rows, targets));
}

main().catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exit(1); });
