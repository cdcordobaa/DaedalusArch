/**
 * ISE prototype measurement, offline part (no Neo4j): (a) style classification, (b) per-file layer accuracy,
 * (c) spec equivalence, and the in-memory Options 1 (majority vote) and 3 (outlier edges) on every variant, for the
 * five dev reference projects and the rename probes (`lib/ise-targets.ts`). Entry file: no exports.
 *
 * Anti-leakage: every inference runs on `snapshotSource(<materialised variant>)` (src/ and tsconfig.json only, in a
 * fresh neutral directory). Ground truth (expected-graph.json, the spec, expected-findings.json) is read here, by the
 * evaluator, and never passed to src/ise.
 *
 * Usage (repository root): npx tsx scripts/v1.3/ise-measure.ts [--out results/v1.3-ise/2026-10-15] [--set dev|heldout|all] [--target id,id]
 * `--set dev` (default) is the prototype's targets (P1-P5: the development probe); `heldout` the probes of
 * `lib/ise-probes.ts`. Writes <out>/measure.json, <out>/measure.md and <out>/specs/<target>.yaml (+ .infer-only.yaml),
 * and for a set with held-out probes <out>/probes.json (their definitions).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import { annotate } from '../../src/ise/layer-mapper.js';
import { applyRules, mineRules, newDeviations } from '../../src/ise/majority-vote.js';
import type { Deviation } from '../../src/ise/majority-vote.js';
import { findOutliers } from '../../src/ise/outliers.js';
import { inferFromGraph, inferSpec } from '../../src/ise/infer.js';
import { loadIseGraph } from '../../src/ise/graph-view.js';
import type { IseGraph } from '../../src/ise/graph-view.js';
import { loadIsePreset } from '../../src/ise/preset.js';
import type { IsePreset } from '../../src/ise/preset.js';
import { snapshotSource } from '../../src/ise/snapshot.js';
import { detectContexts } from '../../src/ise/contexts.js';
import { classifyStyle } from '../../src/ise/style-classifier.js';
import type { IseStyle } from '../../src/ise/style-classifier.js';
import { unitStructure } from '../../src/ise/units.js';
import { dddBlockDiff, fileSpecDiff, globDiff, layerAccuracy, newRows, touches } from './lib/ise-compare.js';
import { materialiseTarget, targetSet, renamedExpectedLayers, renamedFindings, trueSpecText } from './lib/ise-targets.js';
import type { IseTarget } from './lib/ise-targets.js';
import { makeTempRoot } from './lib/materialise.js';
import { loadAllReferences } from './lib/reference-model.js';
import type { LoadedReference } from './lib/reference-model.js';

const PRESETS = path.resolve('presets');
const presetCache = new Map<IseStyle, IsePreset>();
const presetOf = (s: IseStyle): IsePreset => {
  let p = presetCache.get(s);
  if (p === undefined) {
    p = loadIsePreset(s, PRESETS);
    presetCache.set(s, p);
  }
  return p;
};

interface VariantRow {
  variant: string;
  kind: string;
  plants: string | null;
  classifiedAs: IseStyle;
  confidence: number;
  option1: { newDeviations: number; touched: boolean | null; sample: string[] };
  option3: { newOutliers: number; touched: boolean | null; sample: string[] };
}

interface TargetResult {
  id: string;
  style: string;
  rename: Record<string, string>;
  classification: { best: IseStyle; ranked: { style: string; points: number; confidence: number; evidence: readonly string[] }[] };
  specValid: boolean;
  specErrors: readonly string[];
  layerAccuracy: { presetFirst: ReturnType<typeof layerAccuracy>; inferOnly: ReturnType<typeof layerAccuracy> };
  units: { unit: string; layer: string | null; tokenLayer: string | null; structureLayer: string | null; source: string; confidence: number }[];
  specEquivalence: {
    presetFirst: { globs: ReturnType<typeof globDiff>; files: ReturnType<typeof fileSpecDiff> };
    inferOnly: { globs: ReturnType<typeof globDiff>; files: ReturnType<typeof fileSpecDiff> };
    ddd: ReturnType<typeof dddBlockDiff> | null;
  };
  majorityVote: { id: string; kind: string; statement: string; support: number; applies: boolean; mapsTo: readonly string[] }[];
  variants: VariantRow[];
}

function trueLayers(specText: string): { name: string; directories: string[]; filePatterns: string[] }[] {
  const raw = YAML.parse(specText) as { architecture: { layers: { name: string; directories?: string[]; file_patterns?: string[] }[] } };
  return raw.architecture.layers.map((l) => ({ name: l.name, directories: l.directories ?? [], filePatterns: l.file_patterns ?? [] }));
}

async function graphOf(projectDir: string): Promise<IseGraph> {
  const snap = snapshotSource(projectDir);
  try {
    return await loadIseGraph(snap.dir);
  } finally {
    snap.dispose();
  }
}

const sample = (xs: readonly { file: string; target?: string }[]): string[] => xs.slice(0, 4).map((x) => `${x.file}${x.target !== undefined ? ` -> ${x.target}` : ''}`);

async function measureTarget(ref: LoadedReference, target: IseTarget, work: string, specsDir: string): Promise<TargetResult> {
  const clean = ref.variants.find((v) => v.manifest.kind === 'clean');
  if (clean === undefined) throw new Error(`${ref.style}: no clean variant`);
  const cleanDir = materialiseTarget(ref, clean, target, work);

  // Inference on the clean variant's snapshot only.
  const snap = snapshotSource(cleanDir);
  let inf: Awaited<ReturnType<typeof inferSpec>>;
  try {
    inf = await inferSpec(snap.dir, { presetsDir: PRESETS });
  } finally {
    snap.dispose();
  }
  const infOnly = inferFromGraph(inf.graph, { presetsDir: PRESETS, mode: 'infer-only' });
  fs.writeFileSync(path.join(specsDir, `${target.id}.yaml`), inf.specYaml);
  fs.writeFileSync(path.join(specsDir, `${target.id}.infer-only.yaml`), infOnly.specYaml);

  // (b) per-file layers against expected-graph.json.
  const expected = renamedExpectedLayers(ref, target);
  // (c) spec equivalence against the true spec (globs, then the layer of every clean file under each spec).
  const truthText = trueSpecText(ref, target);
  const truth = trueLayers(truthText);
  const files = inf.graph.files;
  const truthAssign = new Map([...annotate(files, truth)].map(([f, a]) => [f, a.layer]));
  const assignOf = (layers: readonly { name: string; directories: readonly string[]; filePatterns: readonly string[] }[]): Map<string, string | null> =>
    new Map([...annotate(files, layers)].map(([f, a]) => [f, a.layer]));
  const trueDdd = (YAML.parse(truthText) as { architecture: { ddd?: Record<string, unknown> } }).architecture.ddd;

  // Option 1 rules mined on clean; Option 3 recomputed on each variant's own graph.
  const contexts = new Set(detectContexts(inf.graph).contexts.map((c) => c.root));
  const mvStructure = unitStructure(inf.graph, (id) => contexts.has(id));
  const rules = mineRules(inf.graph, mvStructure);
  const cleanDeviations = applyRules(rules, inf.graph, mvStructure.units);
  const cleanOutliers = findOutliers(inf.graph, presetOf).outliers;

  const variants: VariantRow[] = [];
  for (const v of ref.variants) {
    const dir = v === clean ? cleanDir : materialiseTarget(ref, v, target, work);
    const g = v === clean ? inf.graph : await graphOf(dir);
    const c = v === clean ? inf.classification : classifyStyle(g);
    const exp = renamedFindings(v.manifest.expectedFindings, target);
    const isViolation = v.manifest.kind === 'violation';
    const dev: Deviation[] = newDeviations(applyRules(rules, g, mvStructure.units), cleanDeviations);
    const out = newRows(findOutliers(g, presetOf).outliers.map((o) => ({ ...o, rule: o.reason })), cleanOutliers.map((o) => ({ ...o, rule: o.reason })));
    variants.push({
      variant: v.manifest.variant,
      kind: v.manifest.kind,
      plants: v.manifest.plants,
      classifiedAs: c.best,
      confidence: c.ranked[0]?.confidence ?? 0,
      option1: { newDeviations: dev.length, touched: isViolation ? touches(dev, [], exp) : null, sample: sample(dev) },
      option3: { newOutliers: out.length, touched: isViolation ? touches(out, [], exp) : null, sample: sample(out) },
    });
    process.stdout.write(`${target.id}/${v.manifest.variant}: ${c.best} (${(c.ranked[0]?.confidence ?? 0).toFixed(2)}), opt1 +${String(dev.length)}, opt3 +${String(out.length)}\n`);
  }

  return {
    id: target.id,
    style: ref.style,
    rename: { ...target.rename },
    classification: { best: inf.classification.best, ranked: inf.classification.ranked.map((r) => ({ style: r.style, points: r.points, confidence: r.confidence, evidence: r.evidence })) },
    specValid: inf.check.valid,
    specErrors: inf.check.errors,
    layerAccuracy: { presetFirst: layerAccuracy(inf.mapping.files, expected), inferOnly: layerAccuracy(infOnly.mapping.files, expected) },
    units: inf.mapping.units.map((u) => ({ ...u })),
    specEquivalence: {
      presetFirst: { globs: globDiff(inf.mapping.layers, truth), files: fileSpecDiff(assignOf(inf.mapping.layers), truthAssign) },
      inferOnly: { globs: globDiff(infOnly.mapping.layers, truth), files: fileSpecDiff(assignOf(infOnly.mapping.layers), truthAssign) },
      ddd: ref.style === 'ddd' || inf.ddd !== undefined ? dddBlockDiff(inf.ddd as Record<string, unknown> | undefined, trueDdd) : null,
    },
    majorityVote: rules.map((r) => ({ id: r.id, kind: r.kind, statement: r.statement, support: r.support, applies: r.applies, mapsTo: r.mapsTo })),
    variants,
  };
}

const pct = (n: number, d: number): string => (d === 0 ? 'n/a' : `${String(n)}/${String(d)} (${((100 * n) / d).toFixed(0)}%)`);

export function renderMeasure(results: readonly TargetResult[]): string {
  const out: string[] = ['# ISE prototype: offline measurement (a)-(c), Options 1 and 3', ''];
  out.push('## (a) Style classification', '', '| Target | True style | Clean classified as | Confidence | Runner-up | Variants classified correctly |', '|---|---|---|---|---|---|');
  for (const r of results) {
    const ok = r.variants.filter((v) => v.classifiedAs === r.style).length;
    const ru = r.classification.ranked[1];
    out.push(`| ${r.id} | ${r.style} | ${r.classification.best} | ${(r.classification.ranked[0]?.confidence ?? 0).toFixed(2)} | ${ru === undefined ? '' : `${ru.style} ${ru.confidence.toFixed(2)}`} | ${pct(ok, r.variants.length)} |`);
  }
  out.push('', '## (b) Per-file layer accuracy (clean variant vs expected-graph.json)', '', '| Target | Preset-first | Infer-only | High-confidence accuracy (preset-first) | Wrong files (preset-first) |', '|---|---|---|---|---|');
  for (const r of results) {
    const a = r.layerAccuracy.presetFirst;
    const b = r.layerAccuracy.inferOnly;
    out.push(`| ${r.id} | ${pct(a.correct, a.total)} | ${pct(b.correct, b.total)} | ${pct(a.byConfidence.high.correct, a.byConfidence.high.total)} | ${a.wrong.slice(0, 3).map((w) => `${w.file}: ${String(w.inferred)} (exp. ${String(w.expected)})`).join('; ')}${a.wrong.length > 3 ? ` (+${String(a.wrong.length - 3)})` : ''} |`);
  }
  out.push('', '## (c) Spec equivalence (inferred vs true spec)', '', '| Target | Spec valid | Glob differences (preset-first) | Files with another layer (preset-first) | Files with another layer (infer-only) | DDD block fields differing |', '|---|---|---|---|---|---|');
  for (const r of results) {
    const g = r.specEquivalence.presetFirst.globs.reduce((s, d) => s + d.onlyInferred.length + d.onlyTrue.length, 0);
    const f = r.specEquivalence.presetFirst.files;
    const fi = r.specEquivalence.inferOnly.files;
    const ddd = r.specEquivalence.ddd;
    out.push(`| ${r.id} | ${r.specValid ? 'yes' : `NO (${String(r.specErrors.length)})`} | ${String(g)} | ${pct(f.differing.length, f.files)} | ${pct(fi.differing.length, fi.files)} | ${ddd === null ? 'n/a' : ddd.length === 0 ? '0' : ddd.map((d) => d.field).join(', ')} |`);
  }
  out.push('', '## Options 1 and 3 on every variant (in memory)', '', 'Violation variants: planted violation touched (a new deviation names a file of an expected finding). Near-miss variants: new deviations (false alarms).', '');
  out.push('| Target | Opt 1 planted touched | Opt 1 near-miss false alarms | Opt 3 planted touched | Opt 3 near-miss false alarms |', '|---|---|---|---|---|');
  for (const r of results) {
    const vio = r.variants.filter((v) => v.kind === 'violation');
    const nm = r.variants.filter((v) => v.kind !== 'violation');
    out.push(`| ${r.id} | ${pct(vio.filter((v) => v.option1.touched === true).length, vio.length)} | ${String(nm.reduce((s, v) => s + v.option1.newDeviations, 0))} over ${String(nm.length)} | ${pct(vio.filter((v) => v.option3.touched === true).length, vio.length)} | ${String(nm.reduce((s, v) => s + v.option3.newOutliers, 0))} over ${String(nm.length)} |`);
  }
  for (const r of results) {
    out.push('', `### ${r.id}`, '', `Units: ${r.units.map((u) => `\`${u.unit}\` = ${u.layer ?? '-'} (${u.source}; token ${u.tokenLayer ?? '-'}, structure ${u.structureLayer ?? '-'})`).join('; ')}`, '');
    out.push(`Evidence for ${r.classification.best}: ${(r.classification.ranked[0]?.evidence ?? []).join('; ')}`, '');
    const diffs = r.specEquivalence.presetFirst.globs.filter((d) => d.onlyInferred.length + d.onlyTrue.length > 0);
    if (diffs.length > 0) out.push(`Glob differences: ${diffs.map((d) => `${d.layer}: +[${d.onlyInferred.join(', ')}] -[${d.onlyTrue.join(', ')}]`).join('; ')}`, '');
    const fd = r.specEquivalence.presetFirst.files.differing;
    if (fd.length > 0) out.push(`Files with another layer: ${fd.map((d) => `${d.file} ${String(d.inferred)} (true ${String(d.truth)})`).join('; ')}`, '');
    out.push('| Variant | Kind | Classified | Opt 1 new | Opt 1 touched | Opt 3 new | Opt 3 touched |', '|---|---|---|---|---|---|---|');
    for (const v of r.variants) {
      out.push(`| ${v.variant} | ${v.kind} | ${v.classifiedAs} ${v.confidence.toFixed(2)} | ${String(v.option1.newDeviations)} | ${v.option1.touched === null ? '' : v.option1.touched ? 'yes' : 'no'} | ${String(v.option3.newOutliers)} | ${v.option3.touched === null ? '' : v.option3.touched ? 'yes' : 'no'} |`);
    }
  }
  return out.join('\n') + '\n';
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  const oi = argv.indexOf('--out');
  const ti = argv.indexOf('--target');
  const out = path.resolve(oi >= 0 ? argv[oi + 1] ?? '' : 'results/v1.3-ise/2026-10-15');
  const only = ti >= 0 ? new Set((argv[ti + 1] ?? '').split(',')) : undefined;
  const specsDir = path.join(out, 'specs');
  fs.mkdirSync(specsDir, { recursive: true });
  const refs = loadAllReferences(process.cwd());
  const work = makeTempRoot('v13-ise-');
  const results: TargetResult[] = [];
  try {
    for (const t of targetSet(argv).filter((x) => only === undefined || only.has(x.id))) {
      const ref = refs.find((r) => r.style === t.style);
      if (ref === undefined) throw new Error(`no reference ${t.style}`);
      results.push(await measureTarget(ref, t, work, specsDir));
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  const probes = targetSet(argv).flatMap((t) => (t.probe !== undefined && (only === undefined || only.has(t.id)) ? [t.probe] : []));
  if (probes.length > 0) fs.writeFileSync(path.join(out, 'probes.json'), JSON.stringify(probes, null, 1) + '\n');
  fs.writeFileSync(path.join(out, 'measure.json'), JSON.stringify(results, null, 1) + '\n');
  fs.writeFileSync(path.join(out, 'measure.md'), renderMeasure(results));
  process.stdout.write(`wrote ${path.join(out, 'measure.md')}\n`);
}

if (process.argv[1]?.endsWith('ise-measure.ts') === true) {
  void run().catch((e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
    process.exitCode = 2;
  });
}
